# OpenRouter Generation Spike — Plan Brief

> Full plan: `context/changes/openrouter-generation-spike/plan.md`

## What & Why

Roadmap F-01: prove that the deployed Lexio app can turn up to 2,000 words of lesson text into structured flashcard proposals through OpenRouter in under 60 seconds, with the API key kept on the server. This is the riskiest technical assumption behind the north-star slice S-01 (paste text → AI proposals → review → collection), so it is checked first and on production, not only locally.

## Starting Point

The app has Astro + React, Supabase sign-in/sign-up, a protected `/dashboard`, and auto-deploy to Cloudflare Workers. There is no AI integration, no JSON API and no unit-test runner — only an end-to-end smoke script in CI.

## Desired End State

A signed-in user opens `/generate`, pastes lesson text, picks one of five models, and sees a spinner with a seconds counter, then a table of proposals (word, Polish translation, other meanings, example sentence, CEFR level) with duration and token usage. A measurement file shows all five models finishing under 60 s on production, and the default model is picked from that data. S-01 reuses the module and endpoint as-is.

## Key Decisions Made

| Decision             | Choice                                                      | Why (1 sentence)                                                                  |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Spike scope          | Reusable module + endpoint, temporary test page             | S-01 only adds review and saving instead of rewriting the integration.            |
| Progress             | Spinner with elapsed seconds, full response at the end      | Simplest code; one JSON validation of the whole result.                           |
| Output fields        | PRD fields + estimated CEFR level                           | Stable contract for S-01 and S-03; measures time on the real response size.       |
| Models               | 5 models in app config, chosen per request on the test page | Lets the user compare and switch models; the default is set from measurements.    |
| Profile model choice | Deferred to S-03 (new PRD FR-016)                           | Keeps F-01 free of database work; the profile is built once, with the CEFR level. |
| Integration          | Plain `fetch` + OpenRouter structured output (JSON schema)  | Risk register warns about Node-only SDKs on the edge runtime.                     |
| Testing              | Vitest unit tests (no network) + live measurement script    | Logic checked on every push; the 60 s budget measured on production.              |
| Access               | Sign-in only; models outside the list rejected              | Every call costs money; the list is the only allowed set.                         |

## Scope

**In scope:**

- Model list (`anthropic/claude-haiku-5.5`, `openai/gpt-6-luna`, `google/gemini-3.8-flash`, `deepseek/deepseek-v4.1-flash`, `mistralai/mistral-large-4-0`)
- Proposal contract, 2,000-word validation, tolerant parser, OpenRouter client
- `POST /api/ai/proposals`, `OPENROUTER_API_KEY` secret, missing-config banner
- `/generate` test page, Vitest + CI step, production measurement script and results

**Out of scope:**

- Streaming, saving proposals, review/edit/reject, de-duplication, lesson tags (S-01)
- PDF input (S-02), "too easy" grouping and the profile model setting (S-03)
- Rate limiting, per-user limits, automatic retries, Screen Wake Lock

## Architecture / Approach

Browser island → `POST /api/ai/proposals` (auth check, validation, secret from `astro:env/server`) → `generateProposals()` in `src/lib/services/ai-generation.service.ts` → OpenRouter chat completions with a JSON schema → `parseProposals()` drops malformed items → JSON response + one structured log line. The `src/lib/ai/` helpers and the service have no Astro imports, so Vitest tests them with a stubbed `fetch`.

## Phases at a Glance

| Phase                      | What it delivers                                              | Key risk                                                                   |
| -------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Contract and core logic | Model list, proposal schema, validation, client, Vitest in CI | A provider ignoring strict JSON schema — covered by the tolerant parser    |
| 2. Endpoint and secret     | Sign-in-only JSON endpoint with clear error statuses          | Secret missing in some environment — handled by a 503 and the banner       |
| 3. Test page               | `/generate` with spinner, model choice, results table         | Long wait without streaming feels stuck — mitigated by the seconds counter |
| 4. Production measurement  | Results for 5 models, default model chosen                    | A model over 60 s or returning bad JSON — replaced and re-measured         |

**Prerequisites:** OpenRouter account with an API key and credit; an existing confirmed Lexio account on production; human approval for `wrangler secret put` and the push to `master`.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Model ids and structured-output support were checked against the live OpenRouter list on 2026-11-03; they can change before Phase 4.
- A non-streamed request of 40–60 s may be cut by mobile networks or screen lock; if measurements sit near the limit, streaming becomes a follow-up change.
- `usage.cost` may not be returned by every provider; cost is shown only when present.

## Success Criteria (Summary)

- A signed-in user gets AI flashcard proposals from pasted text on the deployed app, with visible progress.
- All five configured models finish a ~2,000-word lesson in under 60 s on production, recorded in `measurements.md`.
- `npm test` guards the generation logic in CI without calling OpenRouter.
