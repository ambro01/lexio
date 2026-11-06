<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: OpenRouter Generation Spike

- **Plan**: context/changes/openrouter-generation-spike/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Success criteria re-run on 2026-11-06: `npm test` 21/21, `npx astro check` 0 errors, `npm run build` OK, `eslint .` clean apart from the known local CRLF noise. Not re-run: `npm run smoke` (needs local Supabase + preview; green at e8cd592/0cbcc86) and `npm run measure:generation` (needs account credentials; evidence in measurements.md).

## Findings

### F1 — Unbounded request body; words counted before the character cap

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/ai/proposals.ts:32-38, src/pages/api/ai/proposals.ts:33-38
- **Detail**: `request.json()` parses a body of any size, `requestSchema` has `text: z.string()` with no max, and `validateInput` runs `countWords` (split + Unicode regex per token) before checking `trimmed.length > MAX_INPUT_CHARS`. A signed-in user posting several MB makes the Worker do all that work, which can exceed the 10 ms Free-plan CPU limit (error 1102) instead of returning 400 `too_long`.
- **Fix**: Check the character length before counting words in `validateInput`, and add `.max(MAX_INPUT_CHARS * 2)` (or a `Content-Length` guard) in the endpoint schema.
  - Strength: Bounds the CPU work by input size; keeps the existing 400 contract and messages.
  - Tradeoff: The "too_long" message for a huge input would report a word count computed on the truncated check path — compute words only when length is within the cap.
  - Confidence: HIGH — both lines verified in code.
  - Blind spot: Actual CPU cost on Workers for a multi-MB body not measured.
- **Decision**: FIXED — Content-Length guard (400 too_long) and zod text max (300,000 chars) in src/pages/api/ai/proposals.ts

### F2 — Any signed-up user can trigger unlimited paid generations

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/ai/proposals.ts:26-64
- **Detail**: Signup is open and `/generate` is live in production. There is no rate limit (the plan parks it: "No per-user generation limits or rate limiting"), and each call can use up to 8,000 output tokens. Prompt injection in lesson text only changes the schema-constrained output, which React renders as text, so the risk here is spend, not data.
- **Fix A ⭐ Recommended**: Set a monthly credit limit on the OpenRouter key (dashboard, no code)
  - Strength: Caps the worst case immediately without touching the planned scope; S-01 can add real limits later.
  - Tradeoff: When the cap is hit, generation fails for everyone (502) until it resets.
  - Confidence: HIGH — OpenRouter keys support credit limits.
  - Blind spot: Does not stop one user from using the whole budget.
- **Fix B**: Restrict the endpoint to an email allowlist until S-01
  - Strength: Only you can spend money while the test page exists.
  - Tradeoff: New env var and code path that S-01 must remove; out of plan scope.
  - Confidence: MED — small change, but adds config surface.
  - Blind spot: Allowlist management on the Worker (secret vs. var) not designed.
- **Decision**: SKIPPED

### F3 — 90 s upstream timeout exceeds the 60 s product budget

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/ai-generation.service.ts:7
- **Detail**: The plan specified `AbortSignal.timeout(timeoutMs ?? 90000)`, so this follows the plan, but the plan conflicts with its own NFR (< 60 s). A slow model keeps the spinner running for up to 90 s and shows the 504 "trwało zbyt długo" message 30 s after the budget has already failed; Qwen hit exactly this (504 at 90,000 ms). The measurement script treats ≥ 60 s as a failure, so the endpoint and the measurement disagree.
- **Fix**: Set `DEFAULT_TIMEOUT_MS` to 60000 (and keep the test that stubs a short timeout).
  - Strength: The user gets a clear error within the budget; aligns the endpoint with the measurement.
  - Tradeoff: A model that would have finished at 61–89 s now fails — but such a model is out of budget anyway.
  - Confidence: HIGH — none of the kept models is above 32 s.
  - Blind spot: Long lessons with GPT-6 Luna (32 s on 1,973 words) have little headroom at the 2,000-word maximum.
- **Decision**: FIXED — DEFAULT_TIMEOUT_MS = 60000

### F4 — Documents still say "five models" after the cut to three

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/prd.md:76, context/changes/openrouter-generation-spike/change.md:12, plan.md Progress 4.1/4.4
- **Detail**: The three-model decision is recorded in measurements.md, models.ts and the roadmap, but PRD FR-016 still requires "a fixed list of five models", change.md says "Five selectable models", and Progress rows 4.1 and 4.4 are ticked with "all five models", which reads as false.
- **Fix**: Change FR-016 and change.md to "three", and add a one-line deviation note under the plan's Progress section pointing to measurements.md.
- **Decision**: FIXED — PRD FR-016 and change.md say three; deviation note added to plan Progress

### F5 — Opaque 502s: upstream status and finish_reason not logged

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/ai-generation.service.ts:134-161, src/pages/api/ai/proposals.ts:89
- **Detail**: The log `reason` is a fixed string ("Model message content is not JSON" etc.); `choices[0].finish_reason` is never read, and OpenRouter 402/429 collapse into the generic 502. This is why the DeepSeek and Qwen failures in Phase 4 could not be diagnosed.
- **Fix**: Include the upstream HTTP status and `finish_reason` in the error (and in the log line), never the content.
- **Decision**: FIXED — OpenRouter error message and finish_reason appended to UpstreamError messages (+2 tests, break-checked)

### F6 — Tooling bundle committed inside a feature commit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: commit e8cd592 (.claude/skills/10x-*, .claude/.10x-cli-manifest.json, CLAUDE.md)
- **Detail**: The Phase 2 commit carried ~22 files of 10x CLI skills and a CLAUDE.md rewrite unrelated to the endpoint (disclosed in the message). Harmless for the app, but it muddies history for this change.
- **Fix**: No rewrite; commit tooling updates separately from now on (the current dirty `.claude/` and CLAUDE.md are a good first case).
- **Decision**: FIXED + ACCEPTED-AS-RULE: Commituj aktualizacje narzędzi osobno od zmian funkcjonalnych (tooling files kept out of the review-fix commit)

### F7 — Smoke test does not guard the new routes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:38-56
- **Detail**: Smoke checks that `/dashboard` redirects anonymous users, but not `/generate` (302) or an anonymous `POST /api/ai/proposals` (401 JSON). Both need no API key.
- **Fix**: Add the two steps to `scripts/smoke.mjs`.
- **Decision**: FIXED — two anonymous steps added to scripts/smoke.mjs (/generate 302, POST /api/ai/proposals 401)

### F8 — isRecord helper duplicated three times

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/ai/proposals.ts:77, src/lib/services/ai-generation.service.ts:62, src/components/generation/GenerationSpike.tsx:39
- **Detail**: The same type guard is defined in three files.
- **Fix**: Export it once (e.g. from `src/lib/utils.ts`) and import it.
- **Decision**: FIXED — isRecord exported once from src/lib/utils.ts

### F9 — Island shows "cannot connect" when the server answered with a 5xx

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/generation/GenerationSpike.tsx:59-64
- **Detail**: A non-JSON error response (e.g. a Cloudflare 1102/5xx HTML page) is handled, but shows "Nie udało się połączyć z serwerem", which is misleading when the server did respond.
- **Fix**: Show a status-aware message, e.g. "Błąd serwera (HTTP 5xx). Spróbuj ponownie."
- **Decision**: FIXED — "Błąd serwera (HTTP {status})" for answered-but-unusable responses; network failures keep the connection message

### F10 — CSRF protection relies implicitly on Astro's checkOrigin

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/ai/proposals.ts:33
- **Detail**: The endpoint parses JSON regardless of `Content-Type`. Cross-site `text/plain` POSTs are blocked only by Astro's default `checkOrigin`; safe today, but implicit.
- **Fix**: Return 415 unless `Content-Type` is `application/json`.
- **Decision**: FIXED — 415 bad_request unless Content-Type is application/json (after the 401 check)
