# Paste Text Generation Implementation Plan

## Overview

Build roadmap slice S-01 (north star): a signed-in user enters a lesson tag name, pastes lesson text, gets AI flashcard proposals, reviews each one (edit, reject as "Znam / nieprzydatne" or "Błędne", undo), and accepts the set. Accepted proposals land in the collection with the lesson tag; a word already in the collection only gains the tag. Every proposal's outcome (accepted unchanged / accepted after correction / rejected with a reason) is recorded in the same transaction, because S-03, S-07 and S-09 read these records and they cannot be reconstructed later. The `/generate` spike page is replaced by this flow.

## Current State Analysis

- **AI generation is done (F-01).** `generateProposals()` (`src/lib/services/ai-generation.service.ts:124`) and `POST /api/ai/proposals` (`src/pages/api/ai/proposals.ts:30`) return validated `Proposal[]` (`src/lib/ai/proposals.ts:8-18`) within the 60 s budget. The F-01 plan states S-01 reuses them and replaces the test page.
- **Saving is done (F-02).** `save_flashcard` (`supabase/migrations/20261110221827_flashcard_key_folding.sql:249-319`) inserts a card or finds the existing one by `word_key`, leaves existing content unchanged, creates and links tags, and returns `(flashcard_id, created)`. `saveFlashcard()` wraps it (`src/lib/services/flashcards.service.ts:85`). AGENTS.md requires all flashcard reads and writes to go through `flashcards.service.ts`.
- **Known risk:** concurrent `save_flashcard` calls with opposite tag order can deadlock (40P01) — F-02 impl-review F5, skipped. S-01 must not save cards in parallel.
- **Missing:** a table for proposal outcomes, an atomic "accept the set" write, a lookup of words already in the collection, an accept endpoint, and the review UI. The spike UI (`src/components/generation/GenerationSpike.tsx`) is a read-only table with a model dropdown.
- **DB size limits already enforced** (`20261110221827_flashcard_key_folding.sql:231-243`): word 1–100 chars, translation ≤ 500, example ≤ 500, additional meanings ≤ 10 items / 2,000 chars, tag name 1–50 chars, ≤ 20 tags per `save_flashcard` call.
- `suggestTags(client, prefix?)` returns up to 20 of the user's tags (`flashcards.service.ts:177`) and is listed in `docs/reference/contract-surfaces.md` as used by S-01.

## Desired End State

- `/generate` ("Nowa lekcja") shows a tag field (suggesting existing tags) and a text area with a word counter. "Generuj" shows a spinner with a seconds counter, then a review list.
- Each proposal shows word, translation, other meanings, example and CEFR. It can be edited, rejected as "Znam / nieprzydatne" or "Błędne", and un-rejected. Proposals for words already in the collection carry a "W kolekcji — dostanie tag" badge and cannot be edited.
- "Akceptuj zestaw (N)" saves every non-rejected proposal with the lesson tag and records the outcome of every proposal, all in one database transaction. A summary shows new cards, cards that only gained the tag, and rejected proposals.
- The review survives a reload or tab kill: the draft lives in `localStorage` (per user) until it is accepted or discarded.
- Verification: `npm test`, `npm run check:rls` and `npm run smoke` pass in CI; a full run on production saves cards visible in Supabase with correct outcome rows.

### Key Discoveries:

- `save_flashcard` is `security invoker`, so it can be called from another `security invoker` function in the same transaction with RLS still applied (`20261110221827_flashcard_key_folding.sql:259-261`).
- `word_key` rule `lower(btrim(regexp_replace(x, '\s+', ' ', 'g')))` is a contract surface (`docs/reference/contract-surfaces.md`); the service mirrors it in `toKey()` (`flashcards.service.ts:75`). The outcomes table must use the same rule so S-09 can match words.
- `parseProposals` already de-duplicates words case-insensitively within one generation (`src/lib/ai/proposals.ts:108-125`), so one set never has two proposals for the same word unless the user edits one into another.
- The endpoint pattern to follow: auth check → content-type → Content-Length guard → zod → service → error mapping → one structured log line (`src/pages/api/ai/proposals.ts:30-115`).
- Services are unit-tested with a stubbed Supabase client (`src/lib/services/flashcards.service.test.ts:25-47`); modules under test must not import `astro:*`.

## What We're NOT Doing

- No "too easy" grouping, CEFR profile level or profile model choice (S-03). The outcomes table already allows the `rejected_too_easy` value so S-03 needs no migration.
- No filtering of previously rejected words from new generations (S-09); S-01 only records the rejections.
- No statistics screen (S-07); S-01 only records outcomes.
- No model dropdown: the page always uses `DEFAULT_AI_MODEL_ID`. The endpoint keeps its optional `model` field (the measurement script uses it).
- No server-side storage of generations before accept; the client sends the AI original next to the final version, and the server classifies the outcome.
- No editing of a proposal whose word is already in the collection; no changing an existing card's content from this flow (S-05 edits cards).
- No cross-device draft sync; one draft per user per browser.
- No PDF input (S-02), no rate limiting (Parked), no streaming.
- No fix of the F-02 tag-order deadlock in `save_flashcard`; the accept function passes one tag per set, so the risk does not apply.

## Implementation Approach

Data first, then server, then UI. One new `security invoker` SQL function, `accept_proposal_set`, takes the tag, the model and all items (each with its final content and an already classified outcome). It calls `save_flashcard` for accepted items and inserts one `proposal_outcomes` row per item, so a set is saved completely or not at all. The TypeScript side keeps the business rule "what counts as corrected" in a pure helper (`src/lib/ai/outcomes.ts`) that the endpoint applies before calling the service. The generation endpoint gains an additive `inCollection` flag per proposal from one `word_key IN (...)` query. The UI is a React island with a pure draft model (`src/lib/review-draft.ts`) persisted to `localStorage` by a hook, so its state transitions are unit-tested without React.

## Critical Implementation Details

- **Outcome rule (primary metric).** An accepted proposal is `accepted_corrected` only if its final word, translation, example sentence or additional meanings differ from the AI original after whitespace normalisation (runs collapsed to one space, trimmed; additional meanings compared in order, after dropping blank items). Comparison is case-sensitive. An edit reverted to the original counts as `accepted_unchanged`. CEFR is not editable and not compared. Proposals marked `inCollection` cannot be edited, so they are always `accepted_unchanged`, with `merged = true`.
- **Recorded word.** Rejected items record the AI original word; accepted items record the final word. `merged` is `not created` from `save_flashcard`. This also covers an edit that turns a proposal into a word already in the collection, or into another proposal of the same set.
- **Ordering on production.** The migration must reach production (`npx supabase db push`) before the code that calls `accept_proposal_set` is pushed to `master` (auto-deploy).

## Phase 1: Outcome storage and accept function

### Overview

Add the `proposal_outcomes` table and the atomic `accept_proposal_set` function, regenerate types, extend the RLS check and document the new contract surfaces.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_proposal_outcomes.sql` (create with `npx supabase migration new proposal_outcomes`)

**Intent**: Store one row per reviewed proposal so the content-quality rate (S-07) and the known-words filter (S-09) can be computed. Save a whole accepted set in one transaction.

**Contract**:

- Table `public.proposal_outcomes`: `id uuid pk`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `set_id uuid not null` (one per accept call), `word text not null` (1–100 chars after normalisation), `word_key text generated always as (lower(btrim(regexp_replace(word, '\s+', ' ', 'g')))) stored`, `outcome text not null check (outcome in ('accepted_unchanged','accepted_corrected','rejected_wrong','rejected_known','rejected_too_easy'))`, `merged boolean not null default false`, `model text null` (≤ 100 chars), `tag_name text null` (≤ 50 chars), `created_at timestamptz not null default now()`.
- Index on `(user_id, word_key)` (S-09 lookup).
- RLS enabled; policies for `authenticated` only: `select` and `insert` with `user_id = (select auth.uid())`. No update or delete policies: outcome records are append-only.
- Function `public.accept_proposal_set(p_tag_name text, p_model text, p_items jsonb) returns table (created_count int, merged_count int, rejected_count int)`, `language plpgsql`, `security invoker`, `set search_path = ''`. Raises `22023` when `p_items` is not an array of 1–150 items, when the tag name is blank after normalisation, or when an item has an unknown outcome. For each item: if the outcome starts with `accepted_`, call `public.save_flashcard(word, translation, additionalMeanings, exampleSentence, cefr, array[p_tag_name])` and insert the outcome with `merged = not created`; otherwise insert only the outcome row. All rows share one `gen_random_uuid()` `set_id`. `revoke execute ... from public, anon; grant execute ... to authenticated`.
- Item JSON shape: `{ "word", "translation", "additionalMeanings": string[], "exampleSentence", "cefr": string|null, "outcome" }`. Converting the JSON array to `text[]` is not obvious:

```sql
array(select jsonb_array_elements_text(coalesce(v_item->'additionalMeanings', '[]'::jsonb)))
```

#### 2. Generated types

**File**: `src/db/database.types.ts`

**Intent**: Regenerate with `npm run db:types` after the migration; never edit by hand.

**Contract**: Includes `proposal_outcomes` and `accept_proposal_set`.

#### 3. RLS / contract check

**File**: `scripts/check-rls.mjs`

**Intent**: Lock in isolation and atomicity of the new table and function.

**Contract**: New steps:

- A accepts a set (2 accepted, 1 rejected): returns `(2, 0, 1)`, creates 2 cards with the tag and 3 outcome rows.
- A accepts a set containing an existing word: `merged_count = 1`, the existing card's translation is unchanged, the outcome row has `merged = true`.
- An all-rejected set creates no card and no tag.
- B sees 0 of A's outcome rows.
- A cannot update or delete its own outcome rows (0 rows affected).
- Anon cannot call the function.
- 151 items or a blank tag raises an error, and nothing is written.

#### 4. Contract surfaces

**File**: `docs/reference/contract-surfaces.md`

**Intent**: List the new table, outcome values and function so S-03/S-07/S-09 depend on stable names.

**Contract**: Rows for `public.proposal_outcomes` (relied on by S-03, S-07, S-09), the outcome value set, and `public.accept_proposal_set` (S-01, S-02, S-03).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Types regenerated and committed: `npm run db:types` produces no diff after commit
- RLS and accept-set checks pass: `npm run check:rls`
- Lint and type check pass: `npm run lint` and `npx astro check`

#### Manual Verification:

- In local Studio, `proposal_outcomes` shows RLS enabled with only select and insert policies

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Server: outcome rules, service and endpoints

### Overview

Add the pure outcome classifier and request schema, the service functions, the `inCollection` flag on generation, and the accept endpoint.

### Changes Required:

#### 1. Shared types

**File**: `src/types.ts`

**Intent**: Types for decisions, outcomes and the accept DTOs, shared by the endpoint, service and UI.

**Contract**: `ProposalDecision = "accept" | "reject_known" | "reject_wrong"`; `ProposalOutcome` = the five DB values; `ProposalContent` = editable fields of `Proposal` (`word`, `translation`, `additionalMeanings`, `exampleSentence`); `ReviewProposal = Proposal & { inCollection: boolean }`; `AcceptSetItem = ProposalContent & { cefr: CefrLevel | null; outcome: ProposalOutcome }`; `AcceptProposalSetInput = { tagName: string; model: string; items: AcceptSetItem[] }`; `AcceptSetResult = { created: number; merged: number; rejected: number }`.

#### 2. Outcome classifier and request schema (pure)

**File**: `src/lib/ai/outcomes.ts` (+ `src/lib/ai/outcomes.test.ts`)

**Intent**: The single place that decides unchanged vs corrected vs rejected (see Critical Implementation Details). It also holds the zod schema of the accept request, so it can be tested without Astro.

**Contract**:

- `classifyOutcome(decision, original: ProposalContent, final: ProposalContent): ProposalOutcome`.
- `normaliseContent(content): ProposalContent`: whitespace collapse and trim, blank meanings dropped.
- `MAX_SET_ITEMS = 150`.
- `acceptRequestSchema` (zod): `{ tagName: string (1–50 after trim), model: string (≤ 100), items: 1–150 of { decision, original: Proposal, inCollection: boolean, final?: ProposalContent } }`, with `final` required when `decision === "accept"`. Field limits match the DB: word 1–100, translation 1–500, example ≤ 500, meanings ≤ 10.
- `toAcceptSetItems(request): AcceptSetItem[]`: applies `classifyOutcome`, uses the original as final when `inCollection`, and records the original word for rejected items.

#### 3. Service functions

**File**: `src/lib/services/flashcards.service.ts` (+ tests in `flashcards.service.test.ts`)

**Intent**: Keep every flashcard read/write in the one service, as AGENTS.md requires.

**Contract**:

- `acceptProposalSet(client, input: AcceptProposalSetInput): Promise<AcceptSetResult>`: calls the `accept_proposal_set` RPC and throws `FlashcardStoreError` (code only, no content) on error.
- `findExistingWordKeys(client, words: string[]): Promise<Set<string>>`: one `select("word_key").in("word_key", keys)` with keys from `toKey()`. Returns an empty set without a query when `words` is empty.

#### 4. Generation endpoint: `inCollection`

**File**: `src/pages/api/ai/proposals.ts`

**Intent**: Mark proposals whose word is already in the user's collection, so the review shows the badge and blocks editing.

**Contract**: The 200 response becomes `proposals: ReviewProposal[]` (additive field). After a successful generation, call `findExistingWordKeys` with a client from `createClient(request.headers, cookies)`. If the client is null or the lookup fails, log it and return `inCollection: false` for all (never fail a paid generation). The log line gains `inCollectionCount`.

#### 5. Accept endpoint

**File**: `src/pages/api/proposal-sets.ts`

**Intent**: Persist a reviewed set.

**Contract**: `POST /api/proposal-sets`, JSON only.

- 401 when signed out; 415 for a non-JSON content type; 400 `bad_request` when the Content-Length is over 400 KB or the body fails `acceptRequestSchema`; 503 `not_configured` when the Supabase client is null.
- 200 `{ created, merged, rejected }` on success.
- 500 `store_failed` ("Nie udało się zapisać zestawu. Spróbuj ponownie.") on `FlashcardStoreError`.
- Logs one line `{ event: "proposal_set_accepted", status, items, created, merged, rejected, corrected }`, never content.
- Error messages in Polish, matching the generation endpoint's style.

#### 6. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Guard the new route without credentials.

**Contract**: New step "proposal-sets API rejects anonymous user": `POST /api/proposal-sets` → 401.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new classifier, schema and service tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`
- Smoke passes against the local preview: `npm run smoke`

#### Manual Verification:

- With local Supabase, a `curl`/REST-client call to `POST /api/proposal-sets` with a signed-in cookie saves cards and outcome rows; a second identical call reports them as `merged`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Review UI

### Overview

Rebuild `/generate` as the lesson flow with a per-user `localStorage` draft, and remove the spike component.

### Changes Required:

#### 1. Draft model (pure)

**File**: `src/lib/review-draft.ts` (+ `src/lib/review-draft.test.ts`)

**Intent**: All review state transitions in one pure module, so they are testable and serialisable.

**Contract**:

- `ReviewDraft = { version: 1; tagName; model; createdAt; items: { original: ReviewProposal; final: ProposalContent; decision: ProposalDecision }[] }`.
- Functions: `createDraft(tagName, model, proposals)`, `editItem(draft, index, final)` (no-op when `inCollection`), `setDecision(draft, index, decision)`, `revertItem(draft, index)`, `counts(draft)` → `{ toSave, rejected }`, `toAcceptRequest(draft)`, `parseDraft(unknown): ReviewDraft | null` (rejects malformed or old-version data), `draftStorageKey(userId)` = `lexio:review-draft:<userId>`.
- Accept is blocked while any to-be-saved item has a blank word or translation.

#### 2. Draft hook

**File**: `src/components/hooks/useReviewDraft.ts`

**Intent**: Load the draft from `localStorage` on mount, save it on every change, and clear it after accept or discard.

**Contract**: `useReviewDraft(userId) → { draft, setDraft, clearDraft }`. Unavailable or full storage degrades to in-memory state, without errors.

#### 3. Lesson flow island

**Files**: `src/components/lesson/LessonGenerator.tsx`, `src/components/lesson/ProposalReviewItem.tsx`

**Intent**: The user-facing flow. Mobile-friendly cards, not a table.

**Contract**:

- Stages: **form** (tag input with `<datalist>` of existing tags, text area with `n / 2000 słów`, "Generuj" disabled when the tag is empty, the text is empty or over the limit) → **generating** (spinner + seconds, as in the spike) → **review** → **saving** → **done** (summary: "Nowe fiszki: X · Dodano tag do istniejących: Y · Odrzucone: Z", plus "Nowa lekcja").
- While a draft exists, the form is hidden and the review is shown.
- Generation sends no `model`; the draft stores `meta.model` from the response.
- 0 proposals → message "AI nie znalazło słów do nauki w tym tekście." and back to the form; a generation error keeps the form with its text and offers "Spróbuj ponownie".
- Review header: tag name, counts, "Akceptuj zestaw (N)", and "Odrzuć szkic" (with confirm).
- Each item:
  - **View:** word, translation, meanings, example, CEFR; "Edytuj", "Znam / nieprzydatne", "Błędne".
  - **Edit:** fields for word, translation, meanings (one per line), example; "Gotowe" and "Przywróć oryginał".
  - **Rejected:** collapsed, with the reason and "Cofnij".
  - **`inCollection`:** badge "W kolekcji — dostanie tag", no "Edytuj".
  - An item edited away from the original shows a "poprawione" marker.
- Accept error keeps the draft and shows the server message with a retry.

#### 4. Page and navigation

**Files**: `src/pages/generate.astro`, `src/pages/dashboard.astro`; delete `src/components/generation/GenerationSpike.tsx`

**Intent**: The real page replaces the spike.

**Contract**: The page title becomes "Nowa lekcja". The frontmatter loads tag names via `suggestTags(client)` (an empty list when the client is null or the call fails) and passes `userId`, `tagNames` and the limits to the island. The dashboard link reads "Nowa lekcja". `/generate` stays in `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the draft model tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`
- Smoke still passes (`/generate` redirects anonymous users): `npm run smoke`

#### Manual Verification:

- Locally: generate from `scripts/fixtures/lesson-sample.txt`, edit one proposal, reject one of each kind, undo one rejection, accept. The summary counts match, the cards have the tag in Studio, and the outcome rows show `accepted_corrected` / `rejected_known` / `rejected_wrong` as expected
- An edit reverted with "Przywróć oryginał" is recorded as `accepted_unchanged`
- Generating again from the same text shows the accepted words with the "W kolekcji" badge, and accepting adds the new tag without changing the cards
- Reloading mid-review restores the draft; "Odrzuć szkic" clears it; another user signed in on the same browser does not see it
- The review is usable on a phone-width viewport (390 px)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Production rollout and docs

### Overview

Ship the migration before the code, verify the flow on production, and update the docs.

### Changes Required:

#### 1. Production database

**Intent**: Apply the Phase 1 migration to production before the code that needs it is deployed (human-approved `npx supabase db push`).

**Contract**: `npx supabase migration list` shows the migration applied remotely.

#### 2. Docs

**Files**: `README.md`, `AGENTS.md`

**Intent**: Document the new route and endpoint.

**Contract**:

- README route table: `/generate` = "Nowa lekcja: paste text → review → accept".
- AGENTS.md:
  - Mention `POST /api/proposal-sets`, and that outcome records are written only through `accept_proposal_set`.
  - Fix the stale sentence "no domain code yet".

### Success Criteria:

#### Automated Verification:

- CI (lint, test, astro check, build, check:rls, smoke) is green on `master` after the push

#### Manual Verification:

- The production migration is applied before the deploy (`npx supabase migration list` shows it remote)
- On the deployed app, a full lesson run (generate → edit → reject → accept) saves cards with the tag, and the outcome rows are visible in the production Supabase table editor
- The production generation still finishes within 60 s with visible progress

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `classifyOutcome`:
  - Unchanged → `accepted_unchanged`.
  - Whitespace-only change → unchanged.
  - Case change in the translation → corrected.
  - Edit reverted → unchanged.
  - A meaning added, removed or reordered → corrected.
  - Blank meaning added → unchanged.
  - Both reject decisions map to their outcome regardless of `final`.
- `acceptRequestSchema` / `toAcceptSetItems`:
  - `final` is required for accept.
  - 151 items rejected.
  - A blank tag is rejected.
  - An `inCollection` item ignores the client `final`.
  - A rejected item records the original word.
- Service: the RPC name and params are mapped; `FlashcardStoreError` carries no content; `findExistingWordKeys` folds keys like `toKey()` and skips the query for an empty list.
- Draft model:
  - Edit, reject, undo and revert transitions.
  - Edit is a no-op on `inCollection` items.
  - Counts.
  - `parseDraft` rejects malformed JSON shapes and the wrong version.
  - `toAcceptRequest` round-trip.

### Integration Tests:

- `scripts/check-rls.mjs` (CI smoke job): atomic accept, merge into an existing word, all-rejected set, isolation, append-only outcomes, the item limit.

### Manual Testing Steps:

1. Run the local end-to-end steps from Phase 3, Manual Verification.
2. Run a production lesson from Phase 4, Manual Verification.
3. Kill the mobile browser tab mid-review and reopen `/generate`: the draft is restored.

## Performance Considerations

- One extra indexed query per generation (`word_key IN (…)`, ≤ ~150 keys, served by the `(user_id, word_key)` unique index).
- Accept is a single RPC; 150 items call `save_flashcard` 150 times inside one transaction. That is acceptable at MVP scale, and the CPU cost is on Postgres, not the Worker.
- The request body is capped at 400 KB before parsing, so the Worker's 10 ms CPU budget is protected (same pattern as the generation endpoint).

## Migration Notes

- The migration is additive (new table + function), so there is no backfill. It must reach production with `npx supabase db push` before the code that calls `accept_proposal_set` is pushed to `master`.
- Rollback: revert the code. The table and function can stay (unused) until a follow-up migration removes them.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01; risks noted on S-07, S-09)
- PRD: `context/foundation/prd.md` (US-01, FR-003, FR-004, FR-005, Success Criteria, Guardrails)
- F-01 plan: `context/changes/openrouter-generation-spike/plan.md`
- F-02 plan and review (deadlock F5): `context/archive/2026-11-10-flashcard-data-contract/`
- Save function pattern: `supabase/migrations/20261110221827_flashcard_key_folding.sql:249-319`
- Endpoint pattern: `src/pages/api/ai/proposals.ts:30-115`
- Service test pattern: `src/lib/services/flashcards.service.test.ts:25-47`
- Lessons: `context/foundation/lessons.md` (no lodash; tooling commits separate from phase commits)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Outcome storage and accept function

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — ee825db
- [x] 1.2 Types regenerated and committed: `npm run db:types` produces no diff after commit — ee825db
- [x] 1.3 RLS and accept-set checks pass: `npm run check:rls` — ee825db
- [x] 1.4 Lint and type check pass: `npm run lint` and `npx astro check` — ee825db

#### Manual

- [x] 1.5 In local Studio, `proposal_outcomes` shows RLS enabled with only select and insert policies — ee825db

### Phase 2: Server: outcome rules, service and endpoints

#### Automated

- [x] 2.1 Unit tests pass, including the new classifier, schema and service tests: `npm test`
- [x] 2.2 Lint and type check pass: `npm run lint` and `npx astro check`
- [x] 2.3 Build passes: `npm run build`
- [x] 2.4 Smoke passes against the local preview: `npm run smoke`

#### Manual

- [x] 2.5 With local Supabase, a signed-in `POST /api/proposal-sets` saves cards and outcome rows; a second identical call reports them as `merged`

### Phase 3: Review UI

#### Automated

- [ ] 3.1 Unit tests pass, including the draft model tests: `npm test`
- [ ] 3.2 Lint and type check pass: `npm run lint` and `npx astro check`
- [ ] 3.3 Build passes: `npm run build`
- [ ] 3.4 Smoke still passes (`/generate` redirects anonymous users): `npm run smoke`

#### Manual

- [ ] 3.5 Local end-to-end run: edit, both rejections, undo, accept; summary, tags and outcome rows match
- [ ] 3.6 An edit reverted with "Przywróć oryginał" is recorded as `accepted_unchanged`
- [ ] 3.7 Regenerating shows the "W kolekcji" badge and accepting only adds the tag
- [ ] 3.8 Reload restores the draft; "Odrzuć szkic" clears it; another user does not see it
- [ ] 3.9 Review is usable at 390 px width

### Phase 4: Production rollout and docs

#### Automated

- [ ] 4.1 CI (lint, test, astro check, build, check:rls, smoke) is green on `master` after the push

#### Manual

- [ ] 4.2 Production migration applied before the deploy
- [ ] 4.3 Full lesson run on production saves cards with the tag and outcome rows
- [ ] 4.4 Production generation still finishes within 60 s with visible progress
