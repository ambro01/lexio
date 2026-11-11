# CEFR Level and "Too Easy" Grouping Implementation Plan

## Overview

Build roadmap slice S-03 (FR-014, FR-016): a signed-in user sets their English level (CEFR) and their AI model on a new profile page. Generation then uses the profile's model, and the review shows new proposals below the user's level in a separate collapsed "too easy" group that can be rejected in one action. Bulk-rejected proposals are recorded with the outcome `rejected_too_easy` ("Za łatwe"), through the same accept path as every other rejection.

## Current State Analysis

- **No profile exists.** There is no table, page or endpoint for user settings.
- **Model choice is half-built.** `POST /api/ai/proposals` accepts an optional `model` and falls back to `DEFAULT_AI_MODEL_ID` (`src/pages/api/ai/proposals.ts:92`). The S-01 page sends no model. The measurement script sends one explicitly. Allowed models live in `src/lib/ai/models.ts` (`AI_MODELS`, `isAiModelId`).
- **Every proposal already has a CEFR estimate.** The prompt asks for it (`src/lib/services/ai-generation.service.ts:20`), and `Proposal.cefr` is validated against `CEFR_LEVELS` (`src/lib/ai/proposals.ts`).
- **The outcome storage already allows "Za łatwe".** `rejected_too_easy` is in the DB check and the accept function (`supabase/migrations/20261110224353_proposal_outcomes.sql:18,93`), in `ProposalOutcome` (`src/types.ts:44`) and in `docs/reference/contract-surfaces.md`. But the decision layer stops at three values:
  - `ProposalDecision` (`src/types.ts:40`)
  - `classifyOutcome` (`src/lib/ai/outcomes.ts:62`)
  - `acceptRequestSchema` (`src/lib/ai/outcomes.ts:94`)
  - the draft schema (`src/lib/review-draft.ts:147`)
- **The review draft** is version 1 (`src/lib/review-draft.ts:9`) and is created in `LessonGenerator.tsx:208`. `/generate` is SSR-loaded with tags (`src/pages/generate.astro:16,34`). Protected routes are listed in `src/middleware.ts:4`.

## Desired End State

- `/profile` ("Profil", protected, linked from the dashboard) shows two selects and "Zapisz":
  - **Twój poziom angielskiego:** "Nie ustawiono", A1–C2.
  - **Model AI:** "Domyślny (<label>)", or one of the three configured models.
- Generation uses the profile's model. With no model set, or a saved model no longer configured, the default is used.
- With a level set, the review shows a collapsed group "Za łatwe dla Ciebie (N)":
  - It holds proposals whose AI level is **strictly below** the profile level and whose word is **not already in the collection**.
  - Opened, it lists the same items with the same actions as the main list (Edytuj, Znam / nieprzydatne, Błędne).
  - "Odrzuć wszystkie jako Za łatwe" rejects every group item that is still accepted and unedited.
  - Afterwards the group shows "Odrzucono N jako Za łatwe" with one "Cofnij" that restores all of them.
- Items left in the group are saved with the set like any other proposal.
- Without a level, the review is unchanged and shows the hint "Ustaw swój poziom w profilu, aby grupować zbyt łatwe słowa", linking to `/profile`.
- The draft keeps the level it was created with. A profile change applies from the next generation.
- Verification:
  - `npm test`, `npm run check:rls` and `npm run smoke` pass in CI.
  - A production lesson with level B1 records `rejected_too_easy` rows for bulk-rejected A1/A2 words.

### Key Discoveries:

- "Too easy" is a pure rule over two existing values, the proposal's `cefr` and the user's level, with the order defined by `CEFR_LEVELS`. It needs no AI change.
- Group undo needs no extra state: `reject_too_easy` is only ever set by the bulk action, so "Cofnij" for the group means "set every item with that decision back to accept".
- An `inCollection` word that is bulk-rejected would record "Za łatwe", and FR-015 (S-09) would then never propose it again. That's why collection words stay out of the group.
- Changing the draft shape needs a version bump. A version-1 draft open in a browser during the deploy must not be thrown away, so it's upgraded as "no level".
- `profiles.ai_model` must not be constrained in SQL: the model list lives in app configuration (FR-016), so validity is checked in the app on save and on use.

## What We're NOT Doing

- No filtering of previously rejected words (S-09). S-03 only records `rejected_too_easy`.
- No statistics (S-07).
- No AI prompt change and no re-rating of CEFR. The AI estimate is used as is, so words are grouped, never hidden.
- No live regrouping of an open draft after a profile change.
- No "too easy" grouping for words already in the collection.
- No per-generation model choice on the lesson page. The model comes only from the profile.
- No other profile fields (name, e-mail, language).
- No change to how the measurement script picks models: it still sends `model` explicitly.

## Implementation Approach

Data first, then UI. Phase 1 adds a per-user `profiles` row and its service, endpoint and page, and makes generation read the profile's model on the server. Phase 2 threads the fourth decision `reject_too_easy` through the existing pure modules: outcome rules, request schema and draft. It adds a pure "too easy" rule and the group UI on top of the S-01 review components, and passes the profile level into the island from the page. Phase 3 ships the migration before the code, then updates the docs.

## Critical Implementation Details

- **Ordering in production:** the `profiles` migration must reach production (`npx supabase db push`) before the code that reads it is pushed to `master` (auto-deploy), as in S-01.
- **The generation endpoint must never fail on the profile lookup.** If the client is null or the read fails, log it and use the default model, as `markInCollection` does for the collection lookup.

## Phase 1: Profile storage and page

### Overview

Store each user's CEFR level and AI model, let them edit both on `/profile`, and make generation use the profile's model.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_profiles.sql` (create with `npx supabase migration new profiles`)

**Intent**: One settings row per user, isolated by RLS.

**Contract**:

- Table `public.profiles`:
  - `user_id uuid primary key default auth.uid() references auth.users on delete cascade`
  - `cefr_level text null check (cefr_level in ('A1','A2','B1','B2','C1','C2'))`
  - `ai_model text null check (char_length(ai_model) between 1 and 100)`
  - `updated_at timestamptz not null default now()`
- RLS enabled. Policies for `authenticated` only: `select`, `insert` and `update` with `user_id = (select auth.uid())` (`using` and `with check`). No delete policy.
- No other grants for `anon`.

#### 2. Generated types and RLS check

**Files**: `src/db/database.types.ts`, `scripts/check-rls.mjs`

**Intent**: Regenerate types (`npm run db:types`), and lock in profile isolation.

**Contract**: New check-rls steps:

- A has no profile row at first.
- A upserts `{ cefr_level: 'B1', ai_model: <id> }` and reads it back.
- B sees 0 profile rows of A.
- B cannot update A's row (0 rows affected).
- B cannot insert a row with `user_id` = A.
- An invalid `cefr_level` ('D1') is rejected.
- Anon cannot select profiles.

#### 3. Shared types and service

**Files**: `src/types.ts`, `src/lib/services/profiles.service.ts` (+ `profiles.service.test.ts`)

**Intent**: Every profile read and write goes through one service, like flashcards.

**Contract**:

- `Profile = { cefrLevel: CefrLevel | null; aiModel: AiModelId | null }`.
- `getProfile(client): Promise<Profile>` returns `{ null, null }` when no row exists. A stored `ai_model` that `isAiModelId` rejects reads as `null`.
- `saveProfile(client, profile: Profile): Promise<Profile>` upserts the caller's row and sets `updated_at`.
- Errors throw `ProfileStoreError` carrying only the code (no content), following `FlashcardStoreError`.

#### 4. Profile endpoint

**File**: `src/pages/api/profile.ts`

**Intent**: Save the profile from the page.

**Contract**: `POST /api/profile`, JSON only, following `src/pages/api/proposal-sets.ts`:

- 401 when signed out, 415 for a non-JSON content type, 400 for a body that fails zod (`{ cefrLevel: CEFR_LEVELS | null, aiModel: AI_MODELS id | null }`), 503 when the client is null.
- 200 with the saved `Profile`.
- 500 `store_failed` ("Nie udało się zapisać profilu. Spróbuj ponownie.").
- One log line `{ event: "profile_saved", status }`.

#### 5. Profile page and navigation

**Files**: `src/pages/profile.astro`, `src/components/profile/ProfileForm.tsx`, `src/pages/dashboard.astro`, `src/middleware.ts`

**Intent**: A small page to view and change the two settings.

**Contract**:

- `/profile` is added to `PROTECTED_ROUTES`. Title "Profil". The page loads `getProfile` (both `null` when the client is null or the read fails) and passes it plus `AI_MODELS` and `DEFAULT_AI_MODEL_ID` to the island.
- The form has two selects:
  - level: "Nie ustawiono" + A1–C2
  - model: "Domyślny (<default label>)" + the three models
- "Zapisz" posts JSON and shows "Zapisano" or the server's message. Its style matches `LessonGenerator`.
- The dashboard gets a "Profil" link.

#### 6. Generation uses the profile model

**File**: `src/pages/api/ai/proposals.ts`

**Intent**: FR-016: the profile decides the model unless the request names one.

**Contract**:

- When `model` is absent, read it with `getProfile` using `createClient(request.headers, cookies)`. Use the profile's model when set, else `DEFAULT_AI_MODEL_ID`.
- A null client or a failed read logs and uses the default; it never fails the request.
- An explicit `model` keeps today's behaviour, including 400 `unknown_model`.
- The log line gains `modelSource: "request" | "profile" | "default"`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Types regenerated and committed: `npm run db:types` produces no diff after commit
- Profile isolation checks pass: `npm run check:rls`
- Unit tests pass, including the profile service tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Locally, `/profile` saves level B1 and a non-default model; after a reload the values are shown
- A generation on "Nowa lekcja" uses the chosen model (the `ai_generation` log line shows it with `modelSource: "profile"`)
- Resetting both to "Nie ustawiono" / "Domyślny" generates with the default model

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: "Too easy" group in the review

### Overview

Add the `reject_too_easy` decision end to end, keep the profile level in the draft, and show the collapsed group with bulk reject and group undo.

### Changes Required:

#### 1. Decision and outcome rules (pure)

**Files**: `src/types.ts`, `src/lib/ai/outcomes.ts` (+ `outcomes.test.ts`)

**Intent**: A fourth decision recorded as "Za łatwe".

**Contract**:

- `ProposalDecision` gains `"reject_too_easy"`.
- `classifyOutcome` maps it to `rejected_too_easy`.
- `acceptRequestSchema` accepts it, with no `final` required, like the other rejections.
- `toAcceptSetItems` records the original word for it, like other rejections.

#### 2. "Too easy" rule (pure)

**File**: `src/lib/ai/cefr.ts` (+ `cefr.test.ts`)

**Intent**: One definition of "too easy".

**Contract**: `isTooEasy(proposal: { cefr: CefrLevel; inCollection: boolean }, level: CefrLevel | null): boolean`. It's true only when `level` is set, `proposal.inCollection` is false, and the proposal's index in `CEFR_LEVELS` is **strictly lower** than the level's. At B1: A2 → true, B1 → false, C1 → false; an A1 word already in the collection → false; any word with no level → false.

#### 3. Draft v2

**File**: `src/lib/review-draft.ts` (+ `review-draft.test.ts`)

**Intent**: Keep the level the draft was created with, and support the bulk actions.

**Contract**:

- `DRAFT_VERSION = 2`.
- `ReviewDraft` gains `level: CefrLevel | null`, and `createDraft(tagName, model, level, proposals, now?)` stores it.
- `parseDraft` accepts version 2, and also version 1 (upgraded with `level: null`). Any other version → `null`.
- `tooEasyIndexes(draft): number[]`: the items for which `isTooEasy(item.original, draft.level)` holds.
- `rejectTooEasy(draft)`: sets `reject_too_easy` on every too-easy item whose decision is `accept` and which is not edited (`isEdited` false). Other items are unchanged.
- `undoTooEasy(draft)`: sets every `reject_too_easy` item back to `accept`.
- `counts(draft)` keeps `{ toSave, rejected }` and adds `tooEasyRejected`.

#### 4. Review UI

**Files**: `src/components/lesson/TooEasyGroup.tsx` (new), `src/components/lesson/LessonGenerator.tsx`, `src/components/lesson/ProposalReviewItem.tsx`, `src/pages/generate.astro`

**Intent**: Show the group and the hint, and pass the level in.

**Contract**:

- `generate.astro` loads `getProfile` (level `null` on a null client or error) and passes `level` to `LessonGenerator`, which passes it to `createDraft`.
- **Main list:** items that are not too easy, in their original order.
- **Group:** a collapsed section "Za łatwe dla Ciebie (N)" with a chevron, followed by the too-easy items.
  - Opened, it renders the same `ProposalReviewItem` for each.
  - Header button "Odrzuć wszystkie jako Za łatwe" (disabled when no item is eligible).
  - After a bulk reject: "Odrzucono N jako Za łatwe" + "Cofnij" (`undoTooEasy`).
  - A `reject_too_easy` item shows the reason "Za łatwe" and its own "Cofnij" (`ProposalReviewItem` gains this label).
- The group is hidden when `tooEasyIndexes` is empty.
- With `draft.level === null`, show the one-line hint linking to `/profile` above the list.
- Header counts and "Akceptuj zestaw (N)" stay correct, because rejected items are not saved.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the decision, "too easy" rule and draft v2 tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`
- Smoke still passes: `npm run smoke`

#### Manual Verification:

- With level B1, a lesson shows A1/A2 words (not already in the collection) in the collapsed group; B1+ words stay in the main list
- "Odrzuć wszystkie jako Za łatwe" + accept records `rejected_too_easy` rows in Studio; edited and individually rejected group items keep their own decision
- Group "Cofnij" restores the bulk-rejected words; group items left alone are saved as cards
- A too-easy word already in the collection stays in the main list with its badge
- Without a level, there is no group and the hint links to `/profile`; changing the level does not regroup an open draft
- A draft open from before the deploy (version 1) still loads
- The group is usable at 390 px width

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Production rollout and docs

### Overview

Apply the migration in production before the code, ship, verify, and update the docs.

### Changes Required:

#### 1. Production database

**Intent**: Apply the `profiles` migration with a human-approved `npx supabase db push` before pushing the code.

**Contract**: `npx supabase migration list` shows it remote.

#### 2. Docs

**Files**: `README.md`, `AGENTS.md`, `docs/reference/contract-surfaces.md`

**Intent**: Document the new route, endpoint, table and rule.

**Contract**:

- README route table: `/profile` = "Profil: CEFR level and AI model".
- AGENTS.md:
  - Profile data goes only through `src/lib/services/profiles.service.ts`.
  - "Too easy" is defined only by `isTooEasy` in `src/lib/ai/cefr.ts`.
- contract-surfaces:
  - A row for `public.profiles` (relied on by S-03, and later S-04 for the level).
  - `rejected_too_easy` is now produced by S-03's bulk reject.

### Success Criteria:

#### Automated Verification:

- CI (lint, test, astro check, build, check:client-only, check:rls, smoke) is green on `master` after the push

#### Manual Verification:

- The production migration is applied before the deploy (`npx supabase migration list` shows it remote)
- On production, a lesson with level B1 groups easy words; the bulk reject records `rejected_too_easy` rows in the production table editor
- The production profile page saves the level and model, and the next generation uses the model

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `isTooEasy`:
  - The boundary: at B1, A2 is too easy and B1 is not.
  - Lowest level: at A1, nothing is too easy.
  - Top of the scale: at C2, C1 is too easy.
  - A word already in the collection is never too easy.
  - No level means nothing is too easy.
- Outcome rules:
  - `reject_too_easy` → `rejected_too_easy`.
  - The schema accepts it without `final`.
  - The original word is recorded.
- Draft v2:
  - The level is stored.
  - A v1 draft is upgraded with `level: null`.
  - v3 or a malformed draft is rejected.
  - `rejectTooEasy` skips edited and individually rejected items.
  - `undoTooEasy` restores only `reject_too_easy` items.
  - The counts are correct.
  - `toAcceptRequest` round-trips through `acceptRequestSchema`.
- Profile service:
  - A missing row gives nulls.
  - An unknown stored model reads as `null`.
  - The upsert maps fields.
  - Errors carry no content.

### Integration Tests:

- `scripts/check-rls.mjs`: profile isolation, insert/update only for your own row, the level check, and anon denied.

### Manual Testing Steps:

1. Set B1 and a model on `/profile`; generate from `scripts/fixtures/lesson-sample.txt`; check the group, bulk reject, undo, accept and the outcome rows.
2. Repeat without a level: no group, hint shown.
3. Production run from Phase 3.

## Performance Considerations

- One extra primary-key read per generation (the profile model) and one per `/generate` page load (the level). Both are negligible.
- The grouping is computed on the client over at most 150 items.

## Migration Notes

- The migration is additive (a new table). It must reach production with `npx supabase db push` before the code is pushed. Rollback: revert the code. The table can stay unused.
- Draft v1 → v2 is upgraded in the browser; nothing is lost on deploy.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-03)
- PRD: `context/foundation/prd.md` (FR-014, FR-016, FR-015, Success Criteria: "Za łatwe" excluded from the quality rate)
- S-01 plan (review, outcomes, draft): `context/archive/2026-11-10-paste-text-generation/plan.md`
- Outcome storage: `supabase/migrations/20261110224353_proposal_outcomes.sql`
- Endpoint pattern: `src/pages/api/proposal-sets.ts`
- Lessons: `context/foundation/lessons.md` (no lodash; tooling commits separate from phase commits)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Profile storage and page

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 3ce50dd
- [x] 1.2 Types regenerated and committed: `npm run db:types` produces no diff after commit — 3ce50dd
- [x] 1.3 Profile isolation checks pass: `npm run check:rls` — 3ce50dd
- [x] 1.4 Unit tests pass, including the profile service tests: `npm test` — 3ce50dd
- [x] 1.5 Lint and type check pass: `npm run lint` and `npx astro check` — 3ce50dd
- [x] 1.6 Build passes: `npm run build` — 3ce50dd

#### Manual

- [x] 1.7 `/profile` saves level and model; values shown after reload — 3ce50dd
- [x] 1.8 Generation uses the profile model (`modelSource: "profile"` in the log) — 3ce50dd
- [x] 1.9 Resetting both settings generates with the default model — 3ce50dd

### Phase 2: "Too easy" group in the review

#### Automated

- [x] 2.1 Unit tests pass, including the decision, "too easy" rule and draft v2 tests: `npm test`
- [x] 2.2 Lint and type check pass: `npm run lint` and `npx astro check`
- [x] 2.3 Build passes: `npm run build`
- [x] 2.4 Smoke still passes: `npm run smoke`

#### Manual

- [x] 2.5 With level B1, A1/A2 words (not in the collection) are in the collapsed group; B1+ stay in the main list
- [x] 2.6 Bulk reject + accept records `rejected_too_easy`; edited and individually rejected items keep their decision
- [x] 2.7 Group "Cofnij" restores the bulk-rejected words; untouched group items are saved
- [x] 2.8 A too-easy word already in the collection stays in the main list
- [x] 2.9 Without a level: no group, hint links to `/profile`; a level change does not regroup an open draft
- [x] 2.10 A version-1 draft from before the deploy still loads
- [x] 2.11 The group is usable at 390 px width

### Phase 3: Production rollout and docs

#### Automated

- [ ] 3.1 CI (lint, test, astro check, build, check:client-only, check:rls, smoke) is green on `master` after the push

#### Manual

- [ ] 3.2 Production migration applied before the deploy
- [ ] 3.3 Production lesson with level B1 groups easy words and records `rejected_too_easy` rows
- [ ] 3.4 Production profile page saves level and model; the next generation uses the model
