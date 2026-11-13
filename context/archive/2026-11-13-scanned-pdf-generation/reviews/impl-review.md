<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Scanned PDF Generation

- **Plan**: context/changes/scanned-pdf-generation/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence:

- **Changed files**: every changed file is listed in the plan, with no unplanned files and no missing items. Known adaptations, all judged harmless:
  - README has no API table, so the route is documented in AGENTS.md;
  - contract-surfaces.md has a new "API routes" table;
  - `extract.ts` exports `PdfPage`, `PdfViewport` and `failureReason`;
  - the scan returns early via `Promise.race`.
- **Automated checks, re-run 2026-11-13**:
  - `npm test`: 229/229;
  - `npm run lint`;
  - `npx astro check`: 0 errors;
  - `npm run build` and `npm run check:client-only` pass;
  - CI is green on `da4973e`.
- **Manual checks**: 1.5, 2.5–2.7 and 3.3–3.5 were confirmed by the user, including a production phone run and the Workers logs.

## Findings

### F1 — In-flight page transcriptions cannot be cancelled

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/pdf/scan.ts:118-126; src/components/lesson/PdfLessonInput.tsx:146-180
- **Detail**: After the first failed page, `readScannedLesson` returns at once, but up to 2 OpenRouter calls already in flight still finish and are billed, and their results are discarded. The user cannot cancel a started scan either, so a 15-page scan always runs to the end. The scan cleans up after itself (no unhandled rejections), so the only cost is a few cents of wasted calls.
- **Fix**: Pass an `AbortSignal` from `readScannedLesson` into `transcribe`, and abort it on the first failure (and on a new pick).
  - Strength: no billed calls after a failure; enables a later cancel button.
  - Tradeoff: touches the `transcribe` signature, the fetch helper and the tests for a cost of cents.
  - Confidence: MED. The pattern is simple, but no abort plumbing exists in the codebase yet.
  - Blind spot: OpenRouter may still bill a request that is aborted after the upstream call has started.
- **Decision**: SKIPPED — a few cents of wasted calls; no abort plumbing now

### F2 — Destroy-during-work path of the scan is untested

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/pdf/scan.test.ts
- **Detail**: The fake pdf.js `destroy` never makes later `getPage`/`render` calls reject, so the path where one page fails while other workers are still rendering (and the document is destroyed in `finally`) is not covered. The code handles it: worker rejections go to `.catch` → `fail` (no-op).
- **Fix**: Add a test where `renderPage` rejects on page 2 while page 1's transcription is still pending, and assert that a single `failed`/`request` result comes back with no unhandled rejection.
- **Decision**: FIXED — scan.test.ts: failure while other pages are in flight (break-checked: removing the worker .catch turns it red)

### F3 — Body-size cap relies on the Content-Length header

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/ai/page-text.ts:37-46
- **Detail**: A chunked request without `Content-Length` reaches `request.json()` uncapped. `word-fill.ts` and `proposals.ts` use the same pattern (accepted as F5 in the collection review). Only a signed-in caller can hit it, and only their own request would exceed CPU.
- **Fix**: Accept as a risk, consistent with the other routes; if hardened later, harden all three routes together.
- **Decision**: ACCEPTED — same Content-Length pattern as word-fill and proposals; harden all three together if ever needed

### F4 — No per-user limit on the paid vision endpoint

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/ai/page-text.ts
- **Detail**: Any signed-in user can call `/api/ai/page-text` repeatedly. Each call is bounded (one image of at most 600,000 chars, 3,000 output tokens), and the app has no rate limits anywhere (rate limiting is in the plan's "NOT doing" list).
- **Fix**: Accept as a risk; include this route when rate limiting is added app-wide.
- **Decision**: ACCEPTED — no rate limits anywhere in the app; include this route when they are added

### F5 — Error messages reused from generation wording

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/ai/page-text.ts (401 and 504 messages)
- **Detail**: Two user-facing messages are copied from `proposals.ts` and mention generating, not reading a page:
  - 401: "Zaloguj się, aby generować fiszki."
  - 504: "Generowanie trwało zbyt długo. Spróbuj ponownie."

  During a scan the user sees "Generowanie trwało zbyt długo" while the panel says "Odczytuję skan…".

- **Fix**: Change the 504 message to "Odczyt strony trwał zbyt długo. Spróbuj ponownie." (the 401 can stay).
- **Decision**: FIXED — 504 message is now "Odczyt strony trwał zbyt długo. Spróbuj ponownie."

### F6 — Roadmap still lists the resolved scan questions as open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:232, :257-258
- **Detail**: PRD Open Questions 1–2 were resolved in phase 3, but the roadmap's "Open Roadmap Questions" 1–2 and the S-10 Unknowns line still present them as open. The plan did not include a roadmap edit, so this is a gap in the plan's docs scope.
- **Fix**: Mark Open Roadmap Questions 1–2 as resolved on 2026-11-13 (pointing to the PRD NFRs) and drop the S-10 Unknowns line.
- **Decision**: FIXED — roadmap S-10 Unknowns and Open Roadmap Questions 1–2 marked resolved 2026-11-13
