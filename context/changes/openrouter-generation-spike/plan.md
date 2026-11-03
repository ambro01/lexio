# OpenRouter Generation Spike Implementation Plan

## Overview

Build the AI generation path for Lexio (roadmap F-01): a reusable server-side module that sends lesson text (up to 2,000 words) to one of five configured OpenRouter models and returns validated flashcard proposals (word, Polish translation, additional meanings, example sentence, CEFR level). It is exposed through a sign-in-only API endpoint and a temporary test page with a spinner, and is measured on the deployed Cloudflare Worker against the < 60 s budget. S-01 later replaces the test page with the real review UI and reuses the module and endpoint unchanged.

## Current State Analysis

- No AI integration exists: no SDK in `package.json`, no OpenRouter key in the env schema (`astro.config.mjs:19-24` declares only `SUPABASE_URL` / `SUPABASE_KEY`).
- Secrets follow one pattern: `envField.string({ context: "server", access: "secret", optional: true })`, read via `astro:env/server` (`src/lib/supabase.ts:3`), with a missing-config banner driven by `src/lib/config-status.ts`.
- API routes are `APIRoute` handlers in `src/pages/api/auth/*.ts`; they return redirects (form posts). There is no JSON API yet.
- Page protection is a prefix list `PROTECTED_ROUTES = ["/dashboard"]` in `src/middleware.ts:4`; the middleware already resolves `context.locals.user` on every request.
- No unit-test runner (`AGENTS.md:20`); `scripts/smoke.mjs` is a dependency-free end-to-end check run in CI against a local Supabase without any AI key.
- Platform constraints (`context/foundation/infrastructure.md`): Workers Free plan allows 10 ms CPU per request, but time waiting on `fetch()` is not CPU and wall-clock is unlimited while the client is connected. The risk register recommends plain `fetch` over Node-flavoured SDKs and verifying on the deployed Worker, not only locally.
- Production: `https://lexio.rafalambro.workers.dev`, auto-deployed by Workers Builds on push to `master`; email confirmations are enabled, so measurement needs an existing confirmed account.

## Desired End State

- A signed-in user opens `/generate`, pastes up to 2,000 words, picks one of five models, presses "Generuj" and sees a spinner with an elapsed-seconds counter, then a table of proposals with the duration, token usage and model used.
- `POST /api/ai/proposals` returns 401 for anonymous callers, 400 for empty/too-long input or a model outside the list, 503 when the key is missing, 502/504 for upstream failures, and 200 with validated proposals otherwise.
- `npm test` (Vitest) runs in CI without network access and covers input validation, model allow-listing, proposal parsing and OpenRouter error mapping.
- `context/changes/openrouter-generation-spike/measurements.md` records duration, proposal count, tokens and a quality note for all five models on a ~2,000-word sample, measured on production; every model kept in the list finishes under 60 s, and the default model is chosen from those results.

### Key Discoveries:

- Env schema pattern to extend: `astro.config.mjs:19-24`.
- Missing-config banner list to extend: `src/lib/config-status.ts:11-19`.
- Protected-prefix list to extend: `src/middleware.ts:4`.
- `astro:env/server` cannot be imported by Vitest outside Astro, so testable modules must take the API key as a parameter (only the endpoint imports `astro:env/server`).
- OpenRouter model list (fetched 2026-11-03 from `https://openrouter.ai/api/v1/models`): all five chosen models list `structured_outputs` in `supported_parameters`.

## What We're NOT Doing

- No streaming and no incremental parsing — one request, full JSON response, spinner with elapsed time (user decision).
- No saving of proposals, no review/edit/reject UI, no de-duplication against the collection, no lesson tags — all S-01.
- No PDF input (S-02), no "too easy" grouping (S-03; the CEFR field is only returned here).
- No per-user model choice in the profile — the profile setting is added with S-03 (new PRD FR-016); until then the request carries the model chosen on the test page, defaulting to the configured default.
- No per-user generation limits or rate limiting (Parked in the roadmap), no automatic retries, no Screen Wake Lock (S-01 UI concern).
- No AI SDK dependency — plain `fetch`.

## Implementation Approach

Keep all logic in plain TypeScript modules with no Astro imports — pure helpers in `src/lib/ai/`, the OpenRouter client (I/O) in `src/lib/services/ai-generation.service.ts` per `AGENTS.md:36`, so Vitest can test them directly and S-01/S-04 can call them. The endpoint is a thin adapter: auth check, read the secret, validate the request, call the module, map errors to HTTP statuses, log one structured line. The test page is a single React island. Measurement runs from a dependency-free Node script against production, mirroring `scripts/smoke.mjs`.

## Critical Implementation Details

- **Structured output request**: use OpenRouter's OpenAI-compatible `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` with a top-level object `{ proposals: [...] }` (strict JSON schema requires an object root). Still validate the parsed result in code — providers can ignore `strict`.
- **Performance constraints**: the endpoint must not do CPU-heavy work (10 ms Free-plan CPU). Word counting on 2,000 words and parsing a ~20 KB JSON response are fine; do not add server-side text processing beyond that.
- **Debug & observability**: log one JSON line per generation (`event: "ai_generation"`, model, status, durationMs, inputWords, proposalCount, droppedCount, token counts) and never the lesson text — it is visible in `npx wrangler tail` and Workers observability.

## Phase 1: Contract and core logic

### Overview

Model list, proposal contract, input validation and the OpenRouter client as pure modules, plus Vitest and a CI step.

### Changes Required:

#### 1. Model configuration

**File**: `src/lib/ai/models.ts`

**Intent**: Single place in app config holding the five selectable models and the default, so the endpoint, test page and (later) the profile setting share one list.

**Contract**: `AI_MODELS: readonly { id: string; label: string }[]` with exactly these ids: `anthropic/claude-haiku-5.5`, `openai/gpt-6-luna`, `google/gemini-3.8-flash`, `deepseek/deepseek-v4.1-flash`, `mistralai/mistral-large-4-0`; `DEFAULT_AI_MODEL_ID = "anthropic/claude-haiku-5.5"` (provisional until Phase 4); `isAiModelId(value: unknown): value is AiModelId`.

#### 2. Proposal contract and input validation

**File**: `src/lib/ai/proposals.ts`

**Intent**: Define the proposal shape every later slice relies on, the JSON schema sent to the model, the 2,000-word limit, and a tolerant parser that drops malformed items instead of failing the whole generation.

**Contract**:

- `type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"`.
- `interface Proposal { word: string; translation: string; additionalMeanings: string[]; exampleSentence: string; cefr: CefrLevel }` — `word` in English base form (phrasal verbs allowed), `translation` and `additionalMeanings` in Polish, `exampleSentence` in English.
- `MAX_INPUT_WORDS = 2000`; `MAX_INPUT_CHARS = 30000` (guard against text without spaces); `countWords(text: string): number` (whitespace-separated tokens containing at least one letter or digit).
- `validateInput(text: unknown): { ok: true; text: string; words: number } | { ok: false; code: "empty" | "too_long"; words: number }` — trims; `"too_long"` when words > 2000 or chars > 30000.
- `PROPOSALS_JSON_SCHEMA` — object root `{ proposals: Proposal[] }`, all fields required, `cefr` as enum, `additionalProperties: false`.
- `parseProposals(raw: unknown): { proposals: Proposal[]; dropped: number }` — accepts the parsed object; trims strings; drops items with missing/empty required fields or an invalid CEFR value; drops repeated `word` within the response (case-insensitive, keep first); throws `InvalidModelOutputError` only when the root is not `{ proposals: array }`.

#### 3. OpenRouter client

**File**: `src/lib/services/ai-generation.service.ts`

**Intent**: One function that builds the prompt and request, calls OpenRouter with `fetch`, and returns proposals plus measurement metadata, mapping failures to typed errors the endpoint can translate to HTTP statuses.

**Contract**:

- `generateProposals(opts: { text: string; model: AiModelId; apiKey: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<{ proposals: Proposal[]; dropped: number; model: string; durationMs: number; usage: { promptTokens?: number; completionTokens?: number; costUsd?: number } }>`.
- `POST https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <key>`, `HTTP-Referer: https://lexio.rafalambro.workers.dev`, `X-Title: Lexio`, body `{ model, messages: [system, user], response_format: <json_schema>, max_tokens: 8000, temperature: 0.2, usage: { include: true } }`. `costUsd` is read from `usage.cost` only if present.
- System prompt (English): pick words and phrasal verbs from the lesson worth learning for a Polish adult learner; skip exercise instructions, names and trivial function words; translate into Polish in the meaning used in the text; list other common meanings in Polish; write a short English example sentence; estimate the CEFR level of each word.
- Errors: `UpstreamError` (non-2xx from OpenRouter, network failure, or `choices[0].message.content` missing / not JSON) and `UpstreamTimeoutError` (abort via `AbortSignal.timeout(timeoutMs ?? 90000)`); `InvalidModelOutputError` propagates from `parseProposals`.

#### 4. Vitest setup and tests

**File**: `package.json`, `vitest.config.ts`, `src/lib/ai/*.test.ts`, `src/lib/services/ai-generation.service.test.ts`, `.github/workflows/ci.yml`, `AGENTS.md`

**Intent**: Add a unit-test runner so the logic is checked on every push without network access or an API key, and document it.

**Contract**: devDependency `vitest`; script `"test": "vitest run"`; `vitest.config.ts` with `@` → `./src` alias and `include: ["src/**/*.test.ts"]`; tests import from `vitest` explicitly (no globals). Tests cover: `countWords`/`validateInput` (empty, whitespace only, exactly 2000 words ok, 2001 words too long, 30001 chars too long); `isAiModelId` and the list (5 unique ids, default in list); `parseProposals` (valid, missing field dropped, bad CEFR dropped, duplicate word dropped, bad root throws); `generateProposals` with a stubbed `fetchImpl` (request carries model + json_schema + auth header, 500 → `UpstreamError`, non-JSON content → `UpstreamError`, abort → `UpstreamTimeoutError`). CI `ci` job gets an `npm test` step after lint. `AGENTS.md` "no unit-test runner yet" line replaced with the `npm test` command.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint` (in CI on Linux; locally CRLF noise is pre-existing)
- Build succeeds: `npm run build`

#### Manual Verification:

- The five model ids in `src/lib/ai/models.ts` match the agreed list

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 2: Endpoint and secret

### Overview

Wire the secret into the env schema and expose the module through a sign-in-only JSON endpoint.

### Changes Required:

#### 1. Env schema and config status

**File**: `astro.config.mjs`, `src/lib/config-status.ts`, `.env.example`, `AGENTS.md`

**Intent**: Declare the OpenRouter key like the Supabase secrets (optional, so CI and local builds without it still work) and show the existing missing-config banner when it is absent.

**Contract**: `OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true })`; new `ConfigStatus` entry "OpenRouter" with message "OpenRouter nie jest skonfigurowany — generowanie fiszek AI jest wyłączone."; `.env.example` gains `OPENROUTER_API_KEY=###`; `AGENTS.md` env section mentions the key and that the endpoint returns 503 without it.

#### 2. Generation endpoint

**File**: `src/pages/api/ai/proposals.ts`

**Intent**: Thin adapter between HTTP and `generateProposals`: only signed-in users, only allow-listed models, user-facing Polish error messages, one structured log line per call.

**Contract**: `POST /api/ai/proposals`, request JSON `{ text: string; model?: string }` (missing `model` → `DEFAULT_AI_MODEL_ID`). Responses (all JSON):

- 200 `{ proposals: Proposal[]; meta: { model; durationMs; inputWords; dropped; usage } }`
- 400 `{ error: "empty" | "too_long" | "unknown_model" | "bad_request", message }` — messages: "Wklej tekst lekcji.", "Tekst ma {words} słów — limit to 2000.", "Nieznany model AI.", "Nieprawidłowe żądanie."
- 401 `{ error: "unauthorized", message: "Zaloguj się, aby generować fiszki." }` when `locals.user` is null
- 503 `{ error: "not_configured", message: "Generowanie AI nie jest skonfigurowane." }` when the key is missing
- 502 `{ error: "upstream", message: "Model AI nie odpowiedział poprawnie. Spróbuj ponownie." }` for `UpstreamError` / `InvalidModelOutputError`
- 504 `{ error: "timeout", message: "Generowanie trwało zbyt długo. Spróbuj ponownie." }` for `UpstreamTimeoutError`

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Build succeeds: `npm run build`
- Smoke test still passes: `npm run smoke` (against `npm run preview`)

#### Manual Verification:

- Locally with a key in `.dev.vars`, signed in: `POST /api/ai/proposals` with a short text returns 200 with proposals
- Signed out, the same request returns 401; with 2,001 words it returns 400 `too_long`; with model `foo/bar` it returns 400 `unknown_model`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Test page

### Overview

A temporary, sign-in-only page to run generations by hand and see the result; S-01 replaces it.

### Changes Required:

#### 1. Route protection and page

**File**: `src/middleware.ts`, `src/pages/generate.astro`, `src/pages/dashboard.astro`

**Intent**: Protect `/generate` like `/dashboard` and render the generation island with the model list from config; add a link from the dashboard.

**Contract**: `PROTECTED_ROUTES` gains `"/generate"`; the page passes `AI_MODELS` and `DEFAULT_AI_MODEL_ID` as props to the island (`client:load`); dashboard gets a "Generowanie fiszek (test)" link.

#### 2. Generation island

**File**: `src/components/generation/GenerationSpike.tsx`

**Intent**: Let the user paste text, choose a model and watch progress while the full response is awaited, then inspect proposals and measurement data.

**Contract**: textarea with a live word counter "{n} / 2000 słów" that disables the button above the limit (same `countWords` from `src/lib/ai/proposals.ts`); model `<select>` from props, defaulting to the default model; "Generuj" button disabled while running; spinner with "Generuję… {s} s" updated every second; on success a table (słowo, tłumaczenie, inne znaczenia, przykład, CEFR) and a meta line (model, czas, liczba propozycji, odrzucone, tokeny, koszt if present); on error the server `message` and a "Spróbuj ponownie" button. Reuse `src/components/ui/button.tsx`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Build succeeds: `npm run build`
- Smoke test still passes: `npm run smoke` (against `npm run preview`)

#### Manual Verification:

- Signed out, `/generate` redirects to `/auth/signin`
- Signed in locally, pasting a short lesson text and pressing "Generuj" shows the spinner with a running seconds counter and then the proposals table
- Pasting more than 2,000 words disables "Generuj" and shows the counter over the limit
- An upstream error (e.g. an invalid key in `.dev.vars`) shows the error message and "Spróbuj ponownie"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: Production measurement

### Overview

Put the key on the Worker, deploy, measure all five models on a realistic ~2,000-word sample, record results and choose the default model.

### Changes Required:

#### 1. Sample lesson and measurement script

**File**: `scripts/fixtures/lesson-sample.txt`, `scripts/measure-generation.mjs`, `package.json`

**Intent**: Repeatable, dependency-free measurement on the deployed app (the risk register requires deployed, not local, verification).

**Contract**: fixture is 1,900–2,000 words of English lesson-style text (dialogue, vocabulary in context, exercise instructions, as in real lesson PDFs). Script reads `BASE_URL` (default `https://lexio.rafalambro.workers.dev`), `LEXIO_EMAIL`, `LEXIO_PASSWORD` (an existing confirmed account) and optional `MODELS` (comma list; default all five); signs in via `/api/auth/signin` with a cookie jar like `scripts/smoke.mjs`; posts the fixture to `/api/ai/proposals` once per model sequentially; prints a table (model, HTTP status, durationMs, proposals, dropped, prompt/completion tokens, cost) and exits non-zero if any model errors or exceeds 60,000 ms. Script `"measure:generation": "node scripts/measure-generation.mjs"`.

#### 2. Deployment and secret (human gates)

**File**: none (platform)

**Intent**: Make the key available to the production Worker and ship Phases 1–3.

**Contract**: human runs `npx wrangler secret put OPENROUTER_API_KEY` (value never pasted into the chat); human approves the push to `master`, which triggers Workers Builds; verify with `npx wrangler deployments list`.

#### 3. Results and default model

**File**: `context/changes/openrouter-generation-spike/measurements.md`, `src/lib/ai/models.ts`, `context/deployment/deploy-plan.md`

**Intent**: Record the evidence that F-01 met the budget and settle the default model from data.

**Contract**: `measurements.md` holds the date, sample size in words, and per model: durationMs, proposals, dropped, tokens, cost, and the user's quality note after checking ~10 proposals' Polish translations. Any model that errors or exceeds 60 s is replaced in `AI_MODELS` by another model listing `structured_outputs` and re-measured, keeping five. `DEFAULT_AI_MODEL_ID` is set to the user's choice. `deploy-plan.md` records that `OPENROUTER_API_KEY` is wired as a Worker secret.

### Success Criteria:

#### Automated Verification:

- Measurement script passes against production for all five models (each < 60 s, no errors): `npm run measure:generation`
- Unit tests still pass after the default-model change: `npm test`

#### Manual Verification:

- `/generate` on production works on a phone browser with the screen kept on (spinner, then proposals)
- `measurements.md` contains results and quality notes for all five models, and the chosen default is set in `src/lib/ai/models.ts`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Input validation boundaries: 0, 2,000 and 2,001 words; 30,001 characters without spaces.
- Model allow-list: exactly five unique ids, default included, unknown id rejected.
- Parser tolerance: malformed items dropped and counted, duplicate words removed, bad root rejected.
- Client: request shape (model, schema, headers), error mapping for HTTP 500, non-JSON content and timeout — all with a stubbed `fetch`.

### Integration Tests:

- `npm run smoke` keeps guarding auth and routing; the generation endpoint is not called in CI (no key, no cost).
- `npm run measure:generation` is the end-to-end check against production.

### Manual Testing Steps:

1. Locally, signed in, generate from a short text with each model on `/generate`.
2. Check 401 / 400 / 503 responses as listed in Phase 2.
3. After deploy, run the measurement script and review ~10 proposals per model.
4. Repeat one generation on a phone.

## Performance Considerations

The < 60 s target is dominated by model output time. `max_tokens: 8000` bounds both latency and cost; if every model is close to the limit, the fallback is to switch to streaming (out of scope here; record it in `measurements.md`).

## Migration Notes

No database changes. Rollback is `npx wrangler rollback <version-id>`; the secret can stay in place.

## References

- Roadmap item: `context/foundation/roadmap.md` (F-01 `openrouter-generation-spike`)
- Platform constraints and risks: `context/foundation/infrastructure.md` (Long-request fit, Risk Register)
- Env/secret pattern: `astro.config.mjs:19-24`, `src/lib/supabase.ts:3`, `src/lib/config-status.ts:11-19`
- Route protection: `src/middleware.ts:4`
- Script pattern: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contract and core logic

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 38df6cb
- [x] 1.2 Type checking passes: `npx astro check` — 38df6cb
- [x] 1.3 Linting passes: `npm run lint` (in CI on Linux; locally CRLF noise is pre-existing) — 38df6cb
- [x] 1.4 Build succeeds: `npm run build` — 38df6cb

#### Manual

- [x] 1.5 The five model ids in `src/lib/ai/models.ts` match the agreed list — 38df6cb

### Phase 2: Endpoint and secret

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — e8cd592
- [x] 2.2 Type checking passes: `npx astro check` — e8cd592
- [x] 2.3 Build succeeds: `npm run build` — e8cd592
- [x] 2.4 Smoke test still passes: `npm run smoke` (against `npm run preview`) — e8cd592

#### Manual

- [x] 2.5 Locally with a key in `.dev.vars`, signed in: `POST /api/ai/proposals` with a short text returns 200 with proposals — e8cd592
- [x] 2.6 Signed out, the same request returns 401; with 2,001 words it returns 400 `too_long`; with model `foo/bar` it returns 400 `unknown_model` — e8cd592

### Phase 3: Test page

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — 0cbcc86
- [x] 3.2 Build succeeds: `npm run build` — 0cbcc86
- [x] 3.3 Smoke test still passes: `npm run smoke` (against `npm run preview`) — 0cbcc86

#### Manual

- [x] 3.4 Signed out, `/generate` redirects to `/auth/signin` — 0cbcc86
- [x] 3.5 Signed in locally, pasting a short lesson text and pressing "Generuj" shows the spinner with a running seconds counter and then the proposals table — 0cbcc86
- [x] 3.6 Pasting more than 2,000 words disables "Generuj" and shows the counter over the limit — 0cbcc86
- [x] 3.7 An upstream error (e.g. an invalid key in `.dev.vars`) shows the error message and "Spróbuj ponownie" — 0cbcc86

### Phase 4: Production measurement

#### Automated

- [x] 4.1 Measurement script passes against production for all five models (each < 60 s, no errors): `npm run measure:generation`
- [x] 4.2 Unit tests still pass after the default-model change: `npm test`

#### Manual

- [x] 4.3 `/generate` on production works on a phone browser with the screen kept on (spinner, then proposals)
- [x] 4.4 `measurements.md` contains results and quality notes for all five models, and the chosen default is set in `src/lib/ai/models.ts`
