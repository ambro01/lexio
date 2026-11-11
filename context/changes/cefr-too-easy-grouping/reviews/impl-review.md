<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: CEFR Level and "Too Easy" Grouping

- **Plan**: context/changes/cefr-too-easy-grouping/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 5 observations

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

- **Passed:**
  - `npm run db:types`: identical to the committed file.
  - `npm run check:rls`: all pass.
  - `npm test`: 133 pass.
  - `npm run lint`, `npx astro check`: clean, 0 errors.
  - `npm run build` + `check:client-only`, `npm run smoke`: all pass.
- **CI:** green on `master` at `5f5d0ad`.
- **Not re-run:** `npx supabase db reset`, to keep the local test account. CI ran every migration on a fresh database.
- **Manual checks:** all ticked after user confirmation.

Plan adherence: every planned change matches, with no drift, nothing missing and nothing extra. The disclosed adaptations are judged harmless:

- zod checks the model through `isAiModelId`.
- Extra check-rls steps.
- A `profileLookup` log field.
- One Supabase client per generation request.
- A 1 KB body cap on `/api/profile`.
- A shared `PROPOSAL_DECISIONS` list.
- The group placed above the main list (user-approved).
- Collapsed items stay mounted.
- The bulk-reject button stays visible but disabled.

Verified as correct:

- RLS: select/insert/update own row only. Update has both `using` and `with check`. The upsert payload never sends `user_id`. Anon sees nothing.
- `/api/profile` gates match `proposal-sets.ts`.
- Model resolution: an explicit invalid model → 400; an explicit valid model wins; a profile model no longer configured → default; a failed profile read never fails generation.
- `rejected_too_easy` flows end to end without saving a card.
- The v1→v2 draft upgrade loses nothing and is written back as v2.
- Original indexes are used for both the main list and the group.
- Counts and undo interactions are correct.

## Findings

### F1 — A group item with a problem stays hidden while it blocks "Akceptuj zestaw"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/lesson/TooEasyGroup.tsx:34,86; src/components/lesson/LessonGenerator.tsx:335
- **Detail**:
  - The group's open/closed state is component state that starts closed (`useState(false)`), and its items are `hidden` while closed.
  - If a group item has a problem (e.g. its translation was cleared while editing) and the group is collapsed, or the page is reloaded, then "Akceptuj zestaw" is disabled with "Popraw zaznaczone propozycje…".
  - But the red item isn't visible, so the user can't see what to fix.
- **Fix**: Open the group automatically whenever one of its items has an `itemProblem`, and show a problem count in the group header.
- **Decision**: FIXED — the group stays open while one of its items has a problem; header shows "do poprawy: N"

### F2 — Drafts are forward-only: rolling the code back loses an open review

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/review-draft.ts:197-206; plan.md "Migration Notes" (Rollback: revert the code)
- **Detail**:
  - The pre-S-03 code accepts only `version: 1`. After a code revert, or in a tab still running the old bundle, a v2 draft parses as `null`.
  - The open review then disappears from view, and the next "Generuj" overwrites it.
  - The plan's rollback note doesn't mention this.
- **Fix**: Accept it as a known risk and record it in the change notes. Rollbacks are rare, and the only loss is one unsaved review.
- **Decision**: ACCEPTED — known risk recorded in change.md notes (forward-only draft format)

### F3 — The server accepts `reject_too_easy` for any item

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/ai/outcomes.ts:102-113
- **Detail**:
  - The client applies `reject_too_easy` only to new, below-level words. A crafted request could still mark an `inCollection` word "Za łatwe", which skews only that user's own S-07/S-09 data.
  - The server doesn't know the draft's level, so it can only check the `inCollection` part.
- **Fix**: Add a schema refine that rejects `reject_too_easy` together with `inCollection: true`, plus a test.
- **Decision**: FIXED — acceptRequestSchema rejects reject_too_easy for inCollection items, + test

### F4 — `profiles.updated_at` is set by the Worker, not by the database trigger

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/profiles.service.ts:57; supabase/migrations/20261111144401_profiles.sql:14
- **Detail**:
  - Flashcards use the `public.set_updated_at()` trigger.
  - For profiles, the service sends `updated_at` in the payload, so any client could set it directly through PostgREST.
  - Nothing reads it yet.
- **Fix**: Add a follow-up additive migration with a `profiles_set_updated_at` trigger, and drop the field from the payload. That means another production `db push`.
- **Decision**: FIXED — migration 20261111152142_profiles_updated_at (trigger), service no longer sends updated_at; check-rls step proves a client value is overwritten (needs production db push before deploy)

### F5 — check-rls doesn't test the upsert spoof path or anon writes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/check-rls.mjs:396-466
- **Detail**:
  - The spoof test uses `insert`, but the service uses `upsert`.
  - Anon gets only a `select` check.
  - The policies themselves are correct; only test coverage is missing.
- **Fix**: Add the steps "B: upsert with A's user_id is rejected" and "anon: insert into profiles is rejected".
- **Decision**: FIXED — check-rls steps "B: upsert with A's user_id is rejected" and "anon: insert into profiles is rejected"

### F6 — The bulk-reject eligibility rule is written twice

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/lesson/TooEasyGroup.tsx:35-38; src/lib/review-draft.ts:91-92
- **Detail**: The button's "is anything eligible" check repeats `rejectTooEasy`'s rule (accepted and unedited). If one changes without the other, the button would disagree with what the action does.
- **Fix**: Export `tooEasyEligibleCount(draft)` from `review-draft.ts` (with a test) and use it in the group.
- **Decision**: FIXED — tooEasyEligibleCount() shares the rule with rejectTooEasy; the group gets the count from the parent; test checks count == what the action rejects

### F7 — Minor UX: the editor reopens after "Cofnij"; small tap target

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/lesson/ProposalReviewItem.tsx:49,59; src/components/lesson/TooEasyGroup.tsx:52
- **Detail**:
  - An item left open (but unchanged) in the editor keeps its editing state through a bulk reject, and reappears in edit mode after "Cofnij".
  - The group toggle's tap target is about 28 px, below the ~44 px mobile guideline.
- **Fix**: Accept; both are cosmetic.
- **Decision**: ACCEPTED — cosmetic
