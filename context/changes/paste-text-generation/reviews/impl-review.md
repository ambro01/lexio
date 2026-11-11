<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Paste Text Generation

- **Plan**: context/changes/paste-text-generation/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Success criteria re-run on 2026-11-11:

- **Passed:** `npm test` (75), `npm run lint`, `npx astro check` (0 errors), `npm run build`, `npm run smoke`, `npm run check:rls`. `npm run db:types` produces no diff.
- **CI:** green on `master` (run 42995376314), which includes a fresh-database migration run.
- **Not re-run:** `npx supabase db reset`, to keep local test data. The CI run above covers it.

Disclosed adaptations, all judged harmless:

- `outcomes.ts` exports its field limits for the UI.
- `useReviewDraft` returns an extra `ready` flag and is built on `useSyncExternalStore`.
- `review-draft.ts` has the extra helpers `isEdited`, `isIncomplete` and `canAccept`.
- The CI Supabase CLI pin went in a separate commit (`5db1546`).

## Findings

### F1 — AI output can exceed the accept limits, leaving a draft that can never be saved

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/ai/proposals.ts:111 (with src/lib/ai/outcomes.ts:88-106)
- **Detail**:
  - `parseProposals` puts no limit on the number of proposals, the field lengths or the number of meanings.
  - `acceptRequestSchema` checks `original` against the DB limits for every item, rejected ones included: word ≤100, text ≤500, ≤10 meanings, ≤150 items.
  - So one proposal with 11 meanings, a 501-char translation, or a set of more than 150 makes every accept return the generic 400 "Nieprawidłowe żądanie.".
  - Editing or rejecting the item does not help, because `original` is always sent, and the bad draft survives a reload.
  - The only way out is "Odrzuć szkic", which loses the paid generation and the review work.
  - It is rare (`MAX_TOKENS` 8000, and the prompt asks for "other common meanings"), but nothing tests this path.
- **Fix**: In `parseProposals`, cut meanings to 10, drop items over the word/text limits, cap the list at `MAX_SET_ITEMS`, and count every removed item in `dropped`; add unit tests.
  - Strength: The server then never sends a draft it would refuse. The fix stays in one pure, tested module, and `dropped` is already logged.
  - Tradeoff: Rarely, valid-but-long proposals are dropped or their meanings cut. `proposals.ts` would import the limits from `outcomes.ts`, or the limits move to a shared place.
  - Confidence: HIGH — every limit is already defined in `outcomes.ts`.
  - Blind spot: Drafts already stored in browsers are not repaired. That is acceptable, since none are known to be stuck.
- **Decision**: FIXED — parseProposals cuts meanings to 10, drops over-limit items, caps at 150 (limits moved to src/lib/ai/limits.ts); 3 new tests

### F2 — Accepting the same set twice duplicates its outcome rows

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261110224353_proposal_outcomes.sql:68 (with src/components/lesson/LessonGenerator.tsx:193-205)
- **Detail**:
  - `set_id` is created on the server, so nothing stops the same set from being saved twice.
  - If the RPC commits but the response is lost, the draft stays and "Spróbuj ponownie" writes the whole set again. The cards merge harmlessly, but every outcome row is duplicated, now with `merged=true`.
  - Two tabs with the same draft can do the same.
  - The duplicates skew the S-07 acceptance-rate metric.
  - A double-click in one tab is safe, because the button is disabled as soon as the click is handled.
- **Fix A ⭐ Recommended**: Accept the risk now and handle it in S-07, which owns the metric: keep only the first set of each draft by de-duplicating on a client-sent `draftId` added then.
  - Strength: No migration now, and the trigger (a lost response after commit, or two tabs) is rare at MVP scale.
  - Tradeoff: Rows already written have no draft id, so a duplicate in the current data cannot be told apart.
  - Confidence: MED — depends on how S-07 computes the rate.
  - Blind spot: How often Workers drop responses after a commit has not been measured.
- **Fix B**: Make accept repeat-safe now. `createDraft` generates a `setId` UUID and the request sends it. A new migration adds `p_set_id` and a unique `(user_id, set_id, word_key)`, or a `proposal_sets` row, and a repeat returns the earlier counts.
  - Strength: Fixes the cause for every client, and S-07 data stays clean from day one.
  - Tradeoff: A migration, a production `db push` before the deploy, a change to a contract surface, and new RLS checks.
  - Confidence: HIGH — a standard idempotency-key pattern.
  - Blind spot: The function signature changes, so the S-02/S-03 callers listed in contract-surfaces must use the new signature.
- **Decision**: ACCEPTED (Fix A) — risk accepted for S-01; S-07 adds a client draftId and de-duplicates (queued in follow-ups/review-fixes.md)

### F3 — Meaning limits are not checked in the UI; the server returns a generic 400

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/review-draft.ts:82 (with src/components/lesson/ProposalReviewItem.tsx:113)
- **Detail**:
  - The meanings textarea has no limit, and `isIncomplete`/`canAccept` check only for a blank word or translation.
  - More than 10 meanings, or over 2,000 characters in total, is caught only by the server, which answers "Nieprawidłowe żądanie." without saying which card is wrong.
- **Fix**: Extend the item check in `review-draft.ts` with the meaning limits (≤10 after dropping blanks, ≤2,000 characters joined), using constants exported from `outcomes.ts`, and show the message on the affected card; add a test.
- **Decision**: FIXED — review-draft itemProblem() checks the meaning limits like the server and the card shows the message; 2 new tests

### F4 — Outcome rows can be inserted directly, and check-rls has no cross-user insert test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261110224353_proposal_outcomes.sql:44; scripts/check-rls.mjs:333-350
- **Detail**:
  - The insert policy is needed because `accept_proposal_set` is `security invoker`. Its `with check (user_id = auth.uid())` correctly blocks rows for other users.
  - But a user can insert their own outcome rows directly through PostgREST, and they control `original` and `model`. "Only through accept_proposal_set" (AGENTS.md) is a code rule; the database does not enforce it.
  - Only the user's own metrics can be forged.
  - check-rls covers select, update, delete and anon, but not "B inserts a row with user_id = A → rejected".
- **Fix**: Add that negative check to `check-rls.mjs`, and note the "user-controlled, own rows only" limit in `docs/reference/contract-surfaces.md`.
- **Decision**: SKIPPED

### F5 — Edit fields stay active while the set is saving

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/lesson/ProposalReviewItem.tsx:91-130
- **Detail**: Only the buttons get `disabled`. Text typed while saving is not in the request, and `clearDraft()` throws it away when the save succeeds.
- **Fix**: Pass `disabled={disabled}` to the four inputs/textareas.
- **Decision**: FIXED — the 4 edit fields get disabled={disabled} while saving

### F6 — Editing a word into one already in the collection silently drops the other edits

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/ai/outcomes.ts (toAcceptSetItems) with save_flashcard
- **Detail**:
  - If the user changes a word to one they already have, `save_flashcard` only adds the tag, so the edited translation and meanings are dropped. The row is recorded as `accepted_corrected, merged=true`.
  - The plan explicitly accepts this ("Recorded word … also covers an edit that turns a proposal into a word already in the collection"), and the UI does not warn.
- **Fix**: Accept as designed. Editing existing cards belongs to S-05.
- **Decision**: ACCEPTED — as designed in the plan; editing existing cards belongs to S-05

### F7 — Two concurrent accepts by one user can deadlock (known F-02 risk)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261110224353_proposal_outcomes.sql:86
- **Detail**:
  - Two accepts from two tabs at once, with overlapping words in a different order, can hit a 40P01 deadlock on the `flashcards (user_id, word_key)` unique index.
  - Postgres aborts one transaction, the user sees the 500 retry message, and a retry works. Nothing is partly written.
  - The plan noted this (F-02 F5) and covered only the tag-order case.
- **Fix**: Accept the risk; no change.
- **Decision**: ACCEPTED — known F-02 risk; the whole set rolls back and a retry works
