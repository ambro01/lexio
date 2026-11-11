# Manual Word with AI Fill Implementation Plan

## Overview

Build roadmap slice S-04 (FR-006): on a new "Dodaj słowo" page (`/add`) the user types a word or phrasal verb, optionally with a context sentence. The AI fills in the base form, the Polish translation in the meaning the context implies, other meanings, an example sentence and a CEFR estimate. The user reviews and edits the card, can fill it again after changing the context, and saves it with an optional tag. Saving uses the S-01 accept path with one item and records an outcome marked `source = 'manual'`, so S-07 can include or exclude manual fills.

## Current State Analysis

- **AI call:** `generateProposals` (`src/lib/services/ai-generation.service.ts:117-187`) does one OpenRouter chat call with a strict JSON schema, a 60 s timeout, typed `UpstreamError` / `UpstreamTimeoutError`, model echo and usage. Its prompt and parser are lesson-specific (`SYSTEM_PROMPT`, `PROPOSALS_JSON_SCHEMA`, `parseProposals`).
- **Generation endpoint:** `src/pages/api/ai/proposals.ts` resolves the model from the request, the profile (S-03) or the default, and checks the collection with `findExistingWordKeys`.
- **Save path:**
  - `accept_proposal_set(p_tag_name, p_model, p_items)` (`supabase/migrations/20261110224353_proposal_outcomes.sql:57-131`) saves accepted items through `save_flashcard` and writes one `proposal_outcomes` row per item.
  - It **rejects a blank tag** (22023) and has **no source** field.
  - `save_flashcard` already accepts an empty tag list (`coalesce(p_tag_names, '{}')`, `20261110221827_flashcard_key_folding.sql:91`).
  - `POST /api/proposal-sets` validates with `acceptRequestSchema` (tag required) and classifies with `toAcceptSetItems` (`src/lib/ai/outcomes.ts`).
- **Review UI:** `ProposalReviewItem` (`src/components/lesson/ProposalReviewItem.tsx`) renders one card with edit, revert and reject actions. `itemProblem` / `isEdited` in `src/lib/review-draft.ts` hold the card rules.
- **Limits:** word ≤ 100 chars, texts ≤ 500 (`src/lib/ai/limits.ts`).

## Desired End State

- **Navigation:** `/add` ("Dodaj słowo", protected) is linked from the dashboard and from "Nowa lekcja".
- **The form:** "Słowo" (required, ≤ 100 chars), "Kontekst (opcjonalnie)" (one sentence, ≤ 500 chars), "Uzupełnij".
  - If the typed word is already in the collection, the page says "To słowo jest już w kolekcji" without calling the AI.
- **After the fill:** the reused review card shows word, translation, other meanings, example and CEFR.
  - When the AI changed the word (base form or spelling), the card shows "poprawione z: <typed>". The user can edit it back.
  - If the filled word is already in the collection, the card shows the "W kolekcji" badge and "Zapisz" is blocked with "To słowo jest już w kolekcji".
- **Saving:** "Zapisz" saves with an optional tag (suggestions from the user's tags) and shows "Zapisano: <word>" with "Dodaj kolejne".
- **Fill again:** the inputs stay editable. "Uzupełnij ponownie" re-runs the fill, after a confirm when the card has unsaved edits.
- **Outcome records:**
  - Saving writes one `proposal_outcomes` row with `source = 'manual'` and `accepted_unchanged` or `accepted_corrected` (S-01 rule, comparing the AI fill with the saved card). The tag is null when none was given.
  - Discarding a fill writes nothing.
  - All existing and lesson rows have `source = 'lesson'`.
- Verification: unit tests, `check:rls` and smoke pass in CI, and a production run saves a manual card and its outcome row.

### Key Discoveries:

- Changing `accept_proposal_set`'s parameters needs `drop function` + `create function`. Its `revoke` / `grant` must be repeated for the new signature. `p_source text default 'lesson'` keeps the existing three-argument lesson calls working unchanged.
- `save_flashcard(..., array[]::text[])` saves a card without tags; no change is needed there.
- The fill must be checked against the collection twice: before the AI call (the typed word) and after it (the normalised word). Normalisation can turn a new input into an existing word ("went" → "go").

## What We're NOT Doing

- No editing or overwriting of an existing card's content (S-05).
- No "too easy" grouping or known-words filtering for manual words: FR-015 explicitly allows adding a previously rejected word manually.
- No batch entry of several words, and no history of manual fills.
- No outcome row when a fill is discarded or replaced by "Uzupełnij ponownie": only the saved card is recorded.
- No model choice on the page: the profile model (S-03) or the default is used.
- No change to lesson generation, its prompt or its endpoint.

## Implementation Approach

The data contract comes first, so the save path is ready: a `source` column on outcomes, and an accept function that takes a source and allows no tag for manual saves. Then the AI side: the OpenRouter request is pulled into one shared internal helper, so the word fill adds only its prompt, schema and parser, and gets a JSON endpoint with the two collection checks. Then the page, reusing the S-01 review card and the existing accept endpoint. Production rollout and docs come last, with the migration applied before the code.

## Critical Implementation Details

- **Ordering in production:** the migration must reach production (`npx supabase db push`) before the code that sends `p_source` is deployed. Old code keeps working against the new function thanks to the default.
- **Outcome comparison:** the outcome compares the AI's fill (the "original", with the AI's normalised word) with the saved card, using the existing rule. The user's typed input is never the original. Editing the word back from "go" to "went" therefore counts as `accepted_corrected`.

## Phase 1: Outcome source and manual saves

### Overview

Add `proposal_outcomes.source` and let `accept_proposal_set` save a manual card, with or without a tag.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_manual_outcomes.sql` (create with `npx supabase migration new manual_outcomes`)

**Intent**: Mark where an outcome came from, and allow tagless manual saves through the one accept path.

**Contract**:

- `alter table public.proposal_outcomes add column source text not null default 'lesson' check (source in ('lesson', 'manual'))` (existing rows become `'lesson'`).
- `drop function public.accept_proposal_set(text, text, jsonb)`, then `create function public.accept_proposal_set(p_tag_name text, p_model text, p_items jsonb, p_source text default 'lesson')` with the same `returns table`, `security invoker` and `search_path`, and:
  - `p_source` not in `('lesson', 'manual')` → 22023.
  - Tag: still required (non-blank) for `'lesson'`. For `'manual'`, a null or blank tag means no tag: pass `'{}'::text[]` to `save_flashcard` and store `tag_name = null`.
  - Items: for `'manual'`, exactly 1 item → else 22023. For `'lesson'`, 1–150 as today.
  - The inserted outcome rows carry `source = p_source`.
- `revoke execute ... from public, anon; grant execute ... to authenticated` for the new signature `(text, text, jsonb, text)`.

#### 2. Types, RLS check, contract docs

**Files**: `src/db/database.types.ts`, `scripts/check-rls.mjs`, `docs/reference/contract-surfaces.md`

**Intent**: Regenerate types, lock in the new behaviour, document the contract change.

**Contract**:

- `npm run db:types`.
- New check-rls steps:
  - A manual save with no tag creates 1 card without tags and 1 outcome row with `source = 'manual'` and `tag_name` null.
  - A manual save with a tag tags the card.
  - A manual save with 2 items is rejected, and nothing is written.
  - A lesson save without `p_source` still works, and its rows have `source = 'lesson'`.
  - A lesson save with a blank tag is still rejected.
  - An unknown source is rejected.
- contract-surfaces:
  - The `proposal_outcomes.source` values.
  - The new `accept_proposal_set` signature and its manual rules (S-04).

#### 3. Accept request schema and service

**Files**: `src/lib/ai/outcomes.ts` (+ test), `src/types.ts`, `src/lib/services/flashcards.service.ts` (+ test), `src/pages/api/proposal-sets.ts`

**Intent**: Let the accept endpoint carry the source, and the optional tag for manual saves.

**Contract**:

- `acceptRequestSchema` gains `source: "lesson" | "manual"` (default `"lesson"`).
  - When `source === "manual"`, `tagName` may be absent, empty or null, and `items` must have length 1.
  - When `"lesson"`, the rules are unchanged.
- `AcceptProposalSetInput` gains `source` and `tagName: string | null`. `acceptProposalSet` passes `p_source` (and `p_tag_name` null when absent).
- The `proposal_set_accepted` log line gains `source`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Types regenerated and committed: `npm run db:types` produces no diff after commit
- RLS and accept checks pass, including the manual-save steps: `npm run check:rls`
- Unit tests pass, including the source and optional-tag schema tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- After a local lesson accept, Studio shows the new outcome rows with `source = 'lesson'`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Word fill AI and endpoint

### Overview

Fill one card from a word and an optional context, with the same OpenRouter handling as lesson generation.

### Changes Required:

#### 1. Shared OpenRouter request

**File**: `src/lib/services/ai-generation.service.ts` (+ existing tests)

**Intent**: One place for the HTTP call, the timeout, error typing, model echo and usage, used by both lesson generation and word fill.

**Contract**: An internal `requestStructuredJson({ model, apiKey, system, user, schemaName, schema, maxTokens, fetchImpl?, timeoutMs? })` returns `{ parsed: unknown; model; durationMs; usage }` and throws `UpstreamError` / `UpstreamTimeoutError` as today. `generateProposals` keeps its signature and behaviour, and its existing tests must still pass unchanged.

#### 2. Word-fill prompt, schema and parser (pure)

**Files**: `src/lib/ai/word-fill.ts` (+ `word-fill.test.ts`)

**Intent**: The contract of the single-card fill.

**Contract**:

- `WORD_FILL_SYSTEM_PROMPT`: one English word or phrasal verb for a Polish learner.
  - Return the base form, correcting obvious spelling.
  - Translate into Polish in the meaning the context sentence implies (the most common meaning when there is no context).
  - Give other common Polish meanings, one short English example sentence, and a CEFR estimate.
  - JSON only.
- `WORD_FILL_JSON_SCHEMA`: an object with the same fields as one proposal (`word, translation, additionalMeanings, exampleSentence, cefr`), strict.
- `parseWordFill(raw): Proposal`: validates with the same rules as one proposal (reusing the `toProposal`/limits logic in `proposals.ts`). An invalid result throws `InvalidModelOutputError`.
- The user message: `Word: <word>` plus `\nContext: <context>` when given.
- `wordFillInputSchema` (zod): `word` 1–100 chars after whitespace trim/collapse and at most 6 words; `context` optional, ≤ 500 chars, trimmed, empty → absent.
- `fillWord(opts: { word; context?; model; apiKey; fetchImpl?; timeoutMs? })` in the service returns `{ proposal, model, durationMs, usage }`, with `maxTokens` about 800.

#### 3. Word-fill endpoint

**File**: `src/pages/api/ai/word-fill.ts`

**Intent**: The page's fill call, following `src/pages/api/ai/proposals.ts`.

**Contract**: `POST /api/ai/word-fill`, JSON only.

- **Request checks:**
  - 401 when signed out, 415 for a non-JSON type, 400 for a body over 4 KB or failing `wordFillInputSchema`.
  - 503 `not_configured` when `OPENROUTER_API_KEY` or the Supabase client is missing.
- **Collection checks:**
  - **Before the AI:** `findExistingWordKeys([word])` → 409 `in_collection` ("To słowo jest już w kolekcji."). A failed lookup logs and continues.
  - **After the fill:** compute `inCollection` for the filled word (a failed lookup → `false`, logged).
- **Model:** resolved like lesson generation (profile model, else default; a failed profile read → default).
- **Responses:**
  - 200 `{ proposal: ReviewProposal, typedWord, meta: { model, durationMs, usage } }`.
  - 504 `timeout` and 502 `upstream`, with the same messages as lesson generation.
- **Log:** one line `{ event: "word_fill", status, model, modelSource, durationMs, normalised: boolean, inCollection }`, never the word or the context.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including word-fill parser/input tests and the unchanged lesson generation tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`
- Smoke passes, with a new step "word-fill API rejects anonymous user" → 401: `npm run smoke`

#### Manual Verification:

- Locally, `POST /api/ai/word-fill` with a signed-in cookie for "bank" with context "I sat on the bank of the river" returns the river meaning ("brzeg"); a word already in the collection returns 409 without a `word_fill` model call

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: "Dodaj słowo" page

### Overview

The `/add` page: fill, review, fill again, save.

### Changes Required:

#### 1. Page and navigation

**Files**: `src/pages/add.astro`, `src/middleware.ts`, `src/pages/dashboard.astro`, `src/pages/generate.astro` (or `LessonGenerator.tsx` header)

**Intent**: A protected page with the island and the tag suggestions.

**Contract**:

- `/add` is in `PROTECTED_ROUTES`. Title "Dodaj słowo".
- The page loads tag names via `suggestTags` (`[]` on a null client or error) and passes them to the island.
- Links:
  - **Dashboard:** "Dodaj słowo".
  - **"Nowa lekcja":** a small "Dodaj pojedyncze słowo" link to `/add`.

#### 2. Word-fill island

**Files**: `src/components/manual/AddWord.tsx`, reusing `src/components/lesson/ProposalReviewItem.tsx`

**Intent**: The FR-006 flow on a phone.

**Contract**:

- **States:** form → filling (spinner "Uzupełniam…") → review → saving → saved ("Zapisano: <word>" + "Dodaj kolejne", which clears the form).
- **Form:** "Słowo", "Kontekst (opcjonalnie)", "Uzupełnij" (disabled when the word is empty). A 409 response shows "To słowo jest już w kolekcji."; other errors show the server message with "Spróbuj ponownie".
- **Review:**
  - **The card:** `ProposalReviewItem` for the filled proposal, without the reject buttons (a manual card is saved or discarded, not rejected).
  - **Notes on the card:** when the word changed from the typed one, "poprawione z: <typedWord>"; when `inCollection`, the existing badge.
  - **Below the card:**
    - "Tag (opcjonalnie)" with a datalist of suggestions.
    - "Zapisz", disabled when the item has a problem (`itemProblem`) or is in the collection, with the reason shown.
    - "Odrzuć" (discard the fill, back to the form with the inputs kept).
  - **Fill again:** word and context stay editable above the card. "Uzupełnij ponownie" re-runs the fill, after a `confirm` when the card has edits (`isEdited`).
- **Save:** `POST /api/proposal-sets` with `{ source: "manual", tagName: tag || undefined, model: meta.model, items: [{ decision: "accept", original, inCollection: false, final }] }`.
- **State:** in memory only; no localStorage draft.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`
- Smoke passes, with a new step "add redirects anonymous user" → 302 to sign-in: `npm run smoke`

#### Manual Verification:

- Locally: add "bank" with a river context, edit nothing, save with no tag → the card exists without tags and the outcome row is `accepted_unchanged`, `source = 'manual'`, `tag_name` null
- "went" is filled as "go" with "poprawione z: went"; saving it after editing the translation records `accepted_corrected`
- A word already in the collection is stopped before the fill; a typed form that normalises to an existing word shows the badge and blocks "Zapisz"
- Changing the context and pressing "Uzupełnij ponownie" replaces the card (after the confirm when edited); "Odrzuć" records nothing
- Saving with a tag adds the card to that tag; the page is usable at 390 px width

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Production rollout and docs

### Overview

Apply the migration in production before the code, ship, verify, and update the docs.

### Changes Required:

#### 1. Production database

**Intent**: Apply the `manual_outcomes` migration with a human-approved `npx supabase db push` before pushing the code.

**Contract**: `npx supabase migration list` shows it remote.

#### 2. Docs

**Files**: `README.md`, `AGENTS.md`

**Intent**: Document the new route and endpoint.

**Contract**:

- README route table: `/add` = "Dodaj słowo: one word with AI fill".
- AGENTS.md: mention `POST /api/ai/word-fill` and that manual saves go through `accept_proposal_set` with `source = 'manual'`.

### Success Criteria:

#### Automated Verification:

- CI (lint, test, astro check, build, check:client-only, check:rls, smoke) is green on `master` after the push

#### Manual Verification:

- The production migration is applied before the deploy (`npx supabase migration list` shows it remote)
- On a phone in production, adding a word with context saves a card and a `source = 'manual'` outcome row
- A production lesson accept still works and records `source = 'lesson'`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `parseWordFill`:
  - A valid object → `Proposal`.
  - A missing field, an invalid CEFR or over-limit text → `InvalidModelOutputError`.
  - Strings are trimmed and blank meanings dropped.
- `wordFillInputSchema`:
  - An empty word is rejected.
  - More than 6 words or over 100 chars is rejected.
  - An empty context becomes absent.
  - Whitespace is collapsed.
- The shared request: `generateProposals` tests unchanged; `fillWord` sends the word-fill schema and the `Word:` / `Context:` message (stubbed fetch).
- `acceptRequestSchema`:
  - Manual without a tag passes.
  - Manual with 2 items fails.
  - Lesson without a tag still fails.
  - The default source is `"lesson"`.
  - The service passes `p_source`.

### Integration Tests:

- `scripts/check-rls.mjs`:
  - Manual saves with and without a tag.
  - Manual saves with more than 1 item rejected.
  - Lesson saves unchanged.
  - An unknown source rejected.
- Smoke: anonymous `/add` → 302; anonymous `POST /api/ai/word-fill` → 401.

### Manual Testing Steps:

1. The Phase 3 local run (context meaning, normalisation, existing word, fill again, tag).
2. The Phase 4 production run on a phone.

## Performance Considerations

- One small AI call per fill (`max_tokens` about 800): seconds, far below the 60 s budget.
- Two indexed `word_key` lookups per fill, and one profile read.

## Migration Notes

- Additive column with a default (existing rows → `'lesson'`), plus a drop/recreate of `accept_proposal_set` with a defaulted parameter: old code keeps working against the new function.
- It must reach production with `npx supabase db push` before the code.
- Rollback: revert the code; the column and the function stay compatible.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-04)
- PRD: `context/foundation/prd.md` (FR-006; FR-015 allows manual entry of rejected words; FR-016 model)
- S-01 accept path and outcome rules: `context/archive/2026-11-10-paste-text-generation/plan.md`, `supabase/migrations/20261110224353_proposal_outcomes.sql`
- S-03 model resolution and profile: `context/archive/2026-11-11-cefr-too-easy-grouping/plan.md`, `src/pages/api/ai/proposals.ts`
- AI call: `src/lib/services/ai-generation.service.ts`
- Lessons: `context/foundation/lessons.md` (no lodash; tooling commits separate from phase commits)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Outcome source and manual saves

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 0e3331c
- [x] 1.2 Types regenerated and committed: `npm run db:types` produces no diff after commit — 0e3331c
- [x] 1.3 RLS and accept checks pass, including the manual-save steps: `npm run check:rls` — 0e3331c
- [x] 1.4 Unit tests pass, including the source and optional-tag schema tests: `npm test` — 0e3331c
- [x] 1.5 Lint and type check pass: `npm run lint` and `npx astro check` — 0e3331c
- [x] 1.6 Build passes: `npm run build` — 0e3331c

#### Manual

- [x] 1.7 A local lesson accept records outcome rows with `source = 'lesson'` — 0e3331c

### Phase 2: Word fill AI and endpoint

#### Automated

- [x] 2.1 Unit tests pass, including word-fill parser/input tests and the unchanged lesson generation tests: `npm test` — 54e7a5e
- [x] 2.2 Lint and type check pass: `npm run lint` and `npx astro check` — 54e7a5e
- [x] 2.3 Build passes: `npm run build` — 54e7a5e
- [x] 2.4 Smoke passes, including "word-fill API rejects anonymous user": `npm run smoke` — 54e7a5e

#### Manual

- [x] 2.5 Local word-fill: "bank" with a river context gives the river meaning; an existing word returns 409 without an AI call — 54e7a5e

### Phase 3: "Dodaj słowo" page

#### Automated

- [x] 3.1 Unit tests pass: `npm test` — 7adccda
- [x] 3.2 Lint and type check pass: `npm run lint` and `npx astro check` — 7adccda
- [x] 3.3 Build passes: `npm run build` — 7adccda
- [x] 3.4 Smoke passes, including "add redirects anonymous user": `npm run smoke` — 7adccda

#### Manual

- [x] 3.5 Local save without a tag records `accepted_unchanged`, `source = 'manual'`, `tag_name` null — 7adccda
- [x] 3.6 "went" → "go" shows "poprawione z: went"; an edited save records `accepted_corrected` — 7adccda
- [x] 3.7 An existing word is stopped before the fill; a normalised existing word blocks "Zapisz" — 7adccda
- [x] 3.8 "Uzupełnij ponownie" replaces the card (confirm when edited); "Odrzuć" records nothing — 7adccda
- [x] 3.9 Saving with a tag tags the card; the page is usable at 390 px width — 7adccda

### Phase 4: Production rollout and docs

#### Automated

- [ ] 4.1 CI (lint, test, astro check, build, check:client-only, check:rls, smoke) is green on `master` after the push

#### Manual

- [ ] 4.2 Production migration applied before the deploy
- [ ] 4.3 Production phone run saves a card and a `source = 'manual'` outcome row
- [ ] 4.4 A production lesson accept still works and records `source = 'lesson'`
