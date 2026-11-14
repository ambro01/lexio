<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Spaced-Repetition Review Session

- **Plan**: context/changes/spaced-review-session/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence:

- **Plan adherence**: every changed file is in the plan; `CollectionBrowser.tsx` needed no change. Every planned change matches its intent, and the known adaptations are harmless. The NOT-doing list is respected.
- **Bundle**: ts-fsrs is imported only by `src/lib/review/scheduler.ts`, and none of it is in `dist/client`.
- **Automated checks, re-run 2026-11-14**:
  - `npm test`: 296/296;
  - lint;
  - `npx astro check`: 0 errors;
  - `npm run check:rls`: all pass;
  - `npm run db:types`: no diff;
  - CI green on `c00f24a` and `9919ef2`.
- **Manual checks**: 1.7, 2.5, 3.4–3.7 and 4.3–4.5 were confirmed by the user, including the production migration applied before the code push and a production phone session.

## Findings

### F1 — A retried rating after a lost response is stored twice

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/review.service.ts (rateCard); src/components/review/ReviewSession.tsx (retry); migration comment above record_review
- **Detail**: The expected `reps` is read on the server within the same request, so the compare-and-set only stops overlapping requests. If the first rating commits but its response is lost, the user sees the error box and presses "Spróbuj ponownie". The retry reads the new `reps`, passes the check, and stores a second rating and a second log row. The migration comment says a "double submit" is caught, which holds only for concurrent requests.
- **Fix A ⭐ Recommended**: Return `reps` from `review_queue` in `ReviewCard`, send it as `expectedReps` with `/api/review/rate`, and update it on the client after each successful rating.
  - Strength: A retry or a second tab with stale state gets 409 instead of a duplicate rating; this matches the plan's intent ("cannot apply two ratings computed from the same state").
  - Tradeoff: It touches the RPC return shape (a new migration), the types, the request schema, the route, the service and the island.
  - Confidence: MED. The pattern is simple, but it needs a second production migration.
  - Blind spot: A legitimate retry after a lost response would then show 409, so the island should treat 409 on a retry as "already saved".
- **Fix B**: Accept the risk and correct the migration comment to "concurrent double submit".
  - Strength: No code change; a duplicate needs a lost response plus a retry, and costs one extra FSRS step on one card.
  - Tradeoff: Rare duplicate ratings remain possible.
  - Confidence: HIGH. The effect is limited to one card's schedule.
  - Blind spot: The frequency of lost responses on mobile networks is unmeasured.
- **Decision**: ACCEPTED (Fix B) — rare; one extra FSRS step on one card; documented in review.service.ts rateCard (the applied migration is left unchanged)

### F2 — Direct table writes bypass state validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261113200854_review_session.sql:69-84
- **Detail**: The INSERT and UPDATE policies that the security-invoker RPCs need also let a user write their own `review_states`/`review_log` rows through PostgREST, skipping `review_state_from_json`. Values like `stability = 'NaN'` or `due = 'infinity'` would make the next rating of that card fail: an unhandled 500 from `toISOString`, or a repeated `store_failed`. Only the user's own data is affected.
- **Fix**: Accept as a risk; or add CHECK constraints (`isfinite(due)`, stability/difficulty not NaN/infinite) in a later migration.
- **Decision**: ACCEPTED — only the user's own data; nothing writes the tables outside the app

### F3 — Concurrent "Opanowane" and a first rating give a misleading 409

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261113200854_review_session.sql:277
- **Detail**: If `set_flashcard_mastered` creates the state row while a first rating that started from "no row" is in flight, the rating fails with 40001 and shows "Ta karta została już oceniona". It is rare and the data stays correct.
- **Fix**: Skip.
- **Decision**: SKIPPED — very rare, data stays correct

### F4 — "nowa" badge stays on a re-queued card

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/review/session.ts:72; src/components/review/ReviewSession.tsx:362
- **Detail**: "again" re-queues the same `ReviewCard` object with `isNew: true`, so a new card rated "Nie pamiętam" still shows "nowa" when it comes back.
- **Fix**: Re-queue `{ ...card, isNew: false }` in `applyRating`, with a test assertion.
- **Decision**: FIXED — session.ts re-queues { ...card, isNew: false }; session.test.ts asserts it (break-checked)

### F5 — "Opanowane" offered on an already mastered card in tag mode

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/review/ReviewSession.tsx:409-420
- **Detail**: Tag sessions include mastered cards. Pressing "Opanowane" on one sends `mastered: true` again and increases the summary's "Opanowane" count.
- **Fix**: Hide or disable the button when `card.mastered` is true (a small "opanowana" label instead).
- **Decision**: FIXED — ReviewSession.tsx shows an "Opanowana" label instead of the button on a mastered card

### F6 — `(user_id, due)` index is not used by review_queue

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261113200854_review_session.sql:32
- **Detail**: `review_queue` starts from `flashcards`, joins `review_states` by primary key and sorts in memory, so the index only adds write cost. It is harmless at MVP scale.
- **Fix**: Keep it (it is useful for a future "due count" query); revisit if write cost matters.
- **Decision**: SKIPPED — kept for a future due-count query

### F7 — check-rls does not exercise concurrent ratings

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/check-rls.mjs (S-06 stale-reps step)
- **Detail**: Only a sequential stale `p_expected_reps` is tested, so the concurrent compare-and-set path has no test.
- **Fix**: Add a step that runs two `record_review` calls with the same expected `reps` via `Promise.all` and asserts that exactly one succeeds.
- **Decision**: FIXED — check-rls step: two concurrent record_review from the same reps, exactly one stored (ok=1 conflicts=1)

### F8 — A 409 ends the session

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/review/ReviewSession.tsx:160-162, 439-446
- **Detail**: After a 409 the only way forward is "Zacznij od nowa", which loses the rest of the queue. A 404 already drops just the card with a notice.
- **Fix**: Handle 409 like 404: `dropCurrent` plus a notice "Ta karta została już oceniona — pomijam ją.", and continue.
- **Decision**: FIXED — a 409 drops the card with the notice "Ta karta została już oceniona — pomijam ją."; the session continues
