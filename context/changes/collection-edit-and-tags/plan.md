# Collection browse, edit, delete and tags (S-05) Implementation Plan

## Overview

Add a protected "Kolekcja" page (`/collection`) where the user browses their flashcards (newest first, 50 at a time with "Pokaż więcej"), edits a card in place (content and CEFR), deletes it after a confirm, and adds or removes tags as chips that save immediately, with suggestions from all their existing tags. Covers PRD FR-007 and FR-008 (roadmap slice S-05). Editing does not change learning progress and writes nothing to `proposal_outcomes`.

## Current State Analysis

- The service layer was stubbed for S-05 by F-02 but nothing calls it: `listFlashcards`, `updateFlashcard`, `deleteFlashcard`, `suggestTags` in `src/lib/services/flashcards.service.ts`. There are no API routes and no UI for the collection.
- `listFlashcards` has no paging; PostgREST `max_rows` cuts the result at 1,000 rows without an error (`docs/reference/contract-surfaces.md`, Service table). It orders by `created_at` only, and every card saved by one `accept_proposal_set` call shares the same `created_at` (one transaction, one `now()`), so offset paging on that order alone is unstable.
- There is no way to change a card's tags after saving. `UpdateFlashcardInput` deliberately excludes tags (`src/types.ts`). Adding a tag is "create tag if missing + link" — two writes that the codebase does in `security invoker` RPCs (`save_flashcard`).
- `updateFlashcard` writes values as given; whitespace normalisation lives in `normaliseContent` / `contentSchema` in `src/lib/ai/outcomes.ts` (not exported) and in `save_flashcard`.
- RLS already allows `update`/`delete` on `flashcards` and `insert`/`delete` on `flashcard_tags` for the owner; deleting a card cascades its links; tags stay.
- `suggestTags` returns at most 20 tags (alphabetical, optional prefix) — enough for `/add`, not for "load all tags once".

## Desired End State

- `/collection` (protected, linked from the dashboard) shows the user's cards newest first; within one save (same `created_at`) cards are ordered by word. 50 are server-rendered; "Pokaż więcej" appends the next 50 until none remain. An empty collection shows a hint with links to "Nowa lekcja" and "Dodaj słowo".
- Each card shows word, CEFR badge, translation, other meanings, example sentence and tag chips.
- "Edytuj" opens the card's fields (word, translation, other meanings one per line, example, CEFR select with "brak"); "Zapisz" saves whitespace-normalised content; "Anuluj" discards. Renaming to a word the user already has shows "Takie słowo jest już w kolekcji." and keeps the form open.
- "Usuń" asks `Usunąć fiszkę „<word>”?` and removes the card permanently; its tags and AI outcome records stay.
- Tag chips have × (removes the link at once) and an add input with a `<datalist>` of all the user's tags (up to 500); adding creates the tag if new and links it at once. A card holds at most 20 tags. Adding a tag the card already has (any case/spacing) does not duplicate the chip.
- Verify: `npm run check:rls`, `npm test`, `npm run lint`, `npx astro check`, `npm run build` pass; the manual steps in the Testing Strategy pass locally and in production.

### Key Discoveries:

- `src/lib/services/flashcards.service.ts` — `FLASHCARD_SELECT` embeds tags through `flashcard_tags(tag:tags(id, name))`; `updateFlashcard` maps `23505` → `DuplicateWordError`, empty result → `FlashcardNotFoundError`; `deleteFlashcard` returns `FlashcardNotFoundError` on 0 rows.
- `supabase/migrations/20261110221827_flashcard_key_folding.sql` — `save_flashcard` is the pattern for the new RPC: `security invoker`, `set search_path = ''`, whitespace-normalised name, `insert … on conflict (user_id, name_key) do nothing` then select, errcode `22023` for bad input, grants to `authenticated` only.
- `src/pages/api/profile.ts`, `src/pages/api/proposal-sets.ts` — API route pattern: 401 without `locals.user`, 415 unless `application/json`, body size cap, zod `safeParse` → 400 `bad_request`, 503 without a client, store errors → 500 with a Polish message, one structured `console.log` line with no user content.
- `src/components/manual/AddWord.tsx` — island pattern: local `postJson` with type guards, `ErrorBox`, `Spinner`, `window.confirm`, tag `<datalist>`; `src/pages/add.astro` loads tag suggestions server-side and tolerates their failure.
- `src/components/lesson/ProposalReviewItem.tsx` — the edit field layout (word/translation inputs, meanings textarea one per line, example textarea) and `itemProblem` in `src/lib/review-draft.ts` — the client-side content check.
- `scripts/check-rls.mjs` — two-user checks through the anon-key client (`step`, `save`, `cardTagNames` helpers).
- `context/foundation/lessons.md` — no lodash; tooling commits separate from phase commits.

## What We're NOT Doing

- Search or filter by tag (FR-009, parked) and any other sorting option.
- Renaming, merging or deleting tags themselves; a tag left with no cards stays and keeps appearing in suggestions.
- Bulk actions (multi-select delete or tag).
- Undo after delete.
- Writing anything to `proposal_outcomes` on edit or delete — the AI quality rate (S-07) stays review-time only.
- Learning progress / review state (S-06 does not exist yet; edits must simply not introduce any coupling to it).
- Changing `/add`, `/generate`, `save_flashcard` or `accept_proposal_set`.
- Refactoring the existing API routes onto a shared helper.

## Implementation Approach

Keep the data model untouched and add one additive migration for the only multi-write operation (add a tag to a card). Everything else uses plain table calls under existing RLS. Bottom-up: database + service (verified by `check:rls` and unit tests) → API routes (thin, validated, same shape as existing routes) → a single React island that holds the loaded cards in memory and calls the API per action → production rollout with the migration pushed before the code.

## Critical Implementation Details

- **Stable paging order**: order by `created_at desc, word_key asc`. `word_key` is unique per user, so the order is total. The client requests the next page at `offset = number of cards currently loaded` (a delete shrinks it, so nothing is skipped) and drops any card whose `id` is already shown (an edit that renames a card can move it within its `created_at` group).
- **Invalid ids**: route params are checked as UUIDs before any query; a non-UUID returns 404, never a Postgres `22P02` → 500.
- **Rollout order**: the migration must be in production before the code that calls `add_flashcard_tag` (same rule as earlier slices, `context/deployment/deploy-plan.md`).

## Phase 1: Tag RPC and service layer

### Overview

Add the `add_flashcard_tag` function and the service functions the API needs, prove them with `check:rls` and unit tests, and record the new contracts.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_flashcard_tag_edit.sql` (create with `npx supabase migration new flashcard_tag_edit`)

**Intent**: One transaction that links a tag to an existing card, creating the tag if the user has no tag with that name yet, so chip "add" is atomic and the 20-tags-per-card limit is enforced in the database.

**Contract**: `public.add_flashcard_tag(p_flashcard_id uuid, p_tag_name text) returns table (tag_id uuid, tag_name text, linked boolean)`; `language plpgsql`, `security invoker`, `set search_path = ''`; execute revoked from `public, anon`, granted to `authenticated`.

- Name normalised as in `save_flashcard` (`btrim(regexp_replace(…, '\s+', ' ', 'g'))`); blank or longer than 50 → errcode `22023`.
- Card not visible to the caller (missing or another user's) → errcode `P0002`, nothing written.
- Tag: `insert … on conflict (user_id, name_key) do nothing`, then select by `name_key`; the returned `tag_name` is the stored name (as first typed).
- Link already present → `linked = false`, nothing else written. New link when the card already has 20 links → errcode `54000`, nothing written (tag creation rolls back too). The limit is a soft check (count then insert); a race between two concurrent adds may exceed it by one — acceptable.

#### 2. Generated types

**File**: `src/db/database.types.ts`

**Intent**: Regenerate with `npm run db:types` so the RPC is typed.

**Contract**: `Database["public"]["Functions"]["add_flashcard_tag"]`.

#### 3. Service and shared types

**File**: `src/lib/services/flashcards.service.ts`, `src/types.ts`

**Intent**: Paged listing, tag add/remove and a full tag list for suggestions; map the RPC's error codes to the existing error classes plus one new one.

**Contract**:

- `listFlashcards(client, { offset, limit }): Promise<FlashcardPage>` — replaces the unpaged signature (no other callers). Orders `created_at desc, word_key asc`; fetches `limit + 1` rows with `.range()` to compute `hasMore`. `FlashcardPage = { cards: Flashcard[]; hasMore: boolean }` in `src/types.ts`. Export `COLLECTION_PAGE_SIZE = 50`.
- `addFlashcardTag(client, flashcardId, tagName): Promise<{ tag: Tag; linked: boolean }>` — `P0002` → `FlashcardNotFoundError`; `54000` → new `TagLimitError`; other errors → `FlashcardStoreError`.
- `removeFlashcardTag(client, flashcardId, tagId): Promise<void>` — deletes the link row; idempotent (0 rows is not an error); the tag stays.
- `listTags(client): Promise<Tag[]>` — the user's tags ordered by name, capped at `TAG_LIST_LIMIT = 500`.
- `updateFlashcard`, `deleteFlashcard`, `suggestTags` unchanged.

#### 4. RLS and contract checks

**File**: `scripts/check-rls.mjs`

**Intent**: Prove the new function and the edit/delete/tag paths keep users isolated and the rules hold, through the anon-key client.

**Contract**: new section "collection (S-05)" with steps:

- `add_flashcard_tag` on own card with a new name creates one tag and one link (`linked = true`); repeating with different case/spacing returns the same `tag_id`, `linked = false`, no new rows.
- Adding an existing tag name (from `save`) reuses that tag.
- User B calling it with user A's card id → error `P0002`; A's tags and links unchanged; anon → permission error.
- 21st tag on one card → error `54000` and the would-be new tag does not exist.
- Deleting a `flashcard_tags` row keeps the tag; user B cannot delete A's link (0 rows).
- B cannot update or delete A's card (0 rows); A's update of `word` to another of A's words → `23505`.
- Paging order: cards saved in one `accept_proposal_set` call come back ordered by `word_key` with the same `created_at`.

#### 5. Unit tests

**File**: `src/lib/services/flashcards.service.test.ts`

**Intent**: Cover the new service mapping with the existing mocked-client style.

**Contract**: `listFlashcards` passes the range and order and computes `hasMore` from the extra row; `addFlashcardTag` maps `P0002`/`54000`/other codes; `removeFlashcardTag` treats 0 rows as success; `listTags` applies the 500 limit.

#### 6. Contract docs

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Record the new database function and service contracts; drop the "No paging" warning.

**Contract**: add the migration to the Database header; a row for `public.add_flashcard_tag` (signature, return, error codes, 20-per-card limit; relied on by S-05); Service rows for the new `listFlashcards` signature, `addFlashcardTag`, `removeFlashcardTag`, `listTags`, `FlashcardPage`, `TagLimitError`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Types regenerated and committed: `npm run db:types` produces no diff after commit
- RLS and collection checks pass, including the new S-05 section: `npm run check:rls`
- Unit tests pass, including the new service tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`

#### Manual Verification:

- In local Studio, calling `add_flashcard_tag` as a signed-in user on an own card shows the new tag and link rows

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Collection API

### Overview

Expose list, edit, delete and tag add/remove as JSON endpoints in the existing route style.

### Changes Required:

#### 1. Request schemas

**File**: `src/lib/ai/outcomes.ts`, `src/lib/collection.ts` (new), `src/lib/collection.test.ts` (new)

**Intent**: Reuse the review's content rules for edits so a saved card obeys the same limits and normalisation as a newly accepted one.

**Contract**:

- Export `contentSchema` from `outcomes.ts` (no behaviour change).
- In `src/lib/collection.ts`: `editRequestSchema = contentSchema.extend({ cefr: z.enum(CEFR_LEVELS).nullable() })` — all fields required (the form always sends the whole card); `addTagRequestSchema = { name }` normalised like the tag field, 1–50 chars; `pageQuerySchema` — `offset` integer 0–100,000, default 0; `isUuid(value)`.
- Tests: whitespace normalisation and blank meanings dropped, word/translation required, CEFR `null` accepted and unknown level rejected, tag name trimmed/blank rejected/51 chars rejected, bad offsets rejected, `isUuid`.

#### 2. List endpoint

**File**: `src/pages/api/flashcards/index.ts`

**Intent**: Next page of the collection for "Pokaż więcej".

**Contract**: `GET /api/flashcards?offset=<n>` → `200 FlashcardPage` (page size `COLLECTION_PAGE_SIZE`); 401 / 400 / 503 / 500 as in existing routes. Log event `collection_listed` with status and count only.

#### 3. Card endpoint

**File**: `src/pages/api/flashcards/[id].ts`

**Intent**: Edit and delete one card.

**Contract**:

- `PATCH` — JSON-only (415), body cap 8 KB, `editRequestSchema` → `updateFlashcard` → `200 Flashcard`. `DuplicateWordError` → `409 { error: "duplicate_word", message: "Takie słowo jest już w kolekcji." }`; `FlashcardNotFoundError` → `404 { error: "not_found", message: "Ta fiszka już nie istnieje." }`.
- `DELETE` — no body → `deleteFlashcard` → `204`; not found → 404.
- Non-UUID `id` → 404. Log events `flashcard_updated` / `flashcard_deleted` (status only, never content).

#### 4. Card tag endpoints

**File**: `src/pages/api/flashcards/[id]/tags/index.ts`, `src/pages/api/flashcards/[id]/tags/[tagId].ts`

**Intent**: Instant chip add and remove.

**Contract**:

- `POST /api/flashcards/[id]/tags` — JSON-only, body cap 1 KB, `addTagRequestSchema` → `addFlashcardTag` → `200 { tag: Tag, linked: boolean }`. Not found → 404; `TagLimitError` → `409 { error: "tag_limit", message: "Fiszka może mieć najwyżej 20 tagów." }`.
- `DELETE /api/flashcards/[id]/tags/[tagId]` → `removeFlashcardTag` → `204` (also when the link was already gone). Non-UUID ids → 404.
- Log events `flashcard_tag_added` / `flashcard_tag_removed` (status only).

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the collection schema tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Against the local dev server, signed in, the endpoints answer as specified: list returns `hasMore`, PATCH to an existing word gives 409, PATCH/DELETE on a random UUID give 404, a non-UUID id gives 404, POST tag twice returns `linked: false` the second time, DELETE tag returns 204
- Signed out, every endpoint returns 401

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: "Kolekcja" page

### Overview

The page and the island that ties list, paging, edit, delete and tag chips together.

### Changes Required:

#### 1. Page, protection, navigation

**File**: `src/pages/collection.astro` (new), `src/middleware.ts`, `src/pages/dashboard.astro`

**Intent**: Server-render the first page and the tag list, protect the route and link it.

**Contract**: `PROTECTED_ROUTES` gains `"/collection"`. The page calls `listFlashcards(client, { offset: 0, limit: COLLECTION_PAGE_SIZE })` and `listTags(client)`; a tag-list failure falls back to `[]` (as `/add`); a list failure renders an error message with a reload link instead of the island. Layout matches `add.astro` (title "Kolekcja", "← Dashboard" link, wider container). Dashboard gets a "Kolekcja" link next to "Nowa lekcja" / "Dodaj słowo".

#### 2. Client helpers

**File**: `src/lib/collection.ts`, `src/lib/review-draft.ts`, tests

**Intent**: Keep list merging and edit validation pure and tested.

**Contract**:

- `appendPage(cards, page)` — appends, dropping cards whose `id` is already present.
- Extract `contentProblem(content: ProposalContent): string | null` from `itemProblem` in `review-draft.ts` (which then calls it — behaviour unchanged, existing tests stay green) and use it for the edit form.
- `withTag(card, tag)` / `withoutTag(card, tagId)` — return the card with tags deduplicated by id and sorted by name like the service.
- `mergeTagName(names, name)` — adds a newly created tag name to the suggestion list (case-insensitive dedupe by key, sorted).

#### 3. Island

**File**: `src/components/collection/CollectionBrowser.tsx`, `src/components/collection/CollectionCard.tsx`, `src/components/collection/TagChips.tsx` (all new)

**Intent**: The interactive collection, following `AddWord`'s request/error patterns and `ProposalReviewItem`'s field layout and styling.

**Contract**:

- `CollectionBrowser({ initialPage: FlashcardPage, tagNames: string[] })` holds `cards`, `hasMore`, `tagNames`; "Pokaż więcej" calls `GET /api/flashcards?offset=<cards.length>` with a spinner and a retryable `ErrorBox`; empty state when there are no cards.
- `CollectionCard` — view mode as described in Desired End State; "Edytuj" → form with the CEFR `<select>` ("brak" = `null`) and `contentProblem` disabling "Zapisz"; save → `PATCH`, on 200 replace the card with the response; 409 shows the message inline and keeps the form; 404 removes the card and shows a short notice; "Usuń" → `window.confirm` → `DELETE` → remove from the list (404 also removes it).
- `TagChips` — chips with × (`DELETE` tag; on success `withoutTag`); input with `<datalist>` of `tagNames`, `maxLength` 50, Enter or "Dodaj" → `POST`; on success `withTag` and `mergeTagName`; per-card inline error; inputs disabled while a request for that card is in flight.
- Each card's requests are independent; a failure never clears other cards' state.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the collection helper tests and the unchanged review-draft tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`
- Smoke test still passes against the local preview: `npm run smoke`

#### Manual Verification:

- Signed out, `/collection` redirects to sign-in; the dashboard links to "Kolekcja"
- With more than 50 cards, "Pokaż więcej" loads the next ones without duplicates and disappears at the end; cards from one lesson appear together in word order
- Edit: content and CEFR change and survive a reload; extra spaces are collapsed; renaming to an existing word shows the duplicate message; "Anuluj" discards
- Delete: confirm removes the card; cancelling the confirm keeps it; the card's tag still appears in suggestions
- Tags: adding a new tag creates a chip and the name appears in other cards' suggestions; adding an existing tag in different case does not duplicate the chip; × removes the chip and it stays removed after a reload; a 21st tag shows the limit message
- Empty collection shows the hint with links; layout works on a narrow (mobile) viewport

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Production rollout and docs

### Overview

Ship the migration before the code and update the user-facing docs.

### Changes Required:

#### 1. Production database

**File**: production Supabase project

**Intent**: Apply `add_flashcard_tag` before the code that calls it is deployed.

**Contract**: `npx supabase db push` (linked project) before pushing the Phase 1–3 commits to `master`, per `context/deployment/deploy-plan.md`.

#### 2. Docs

**File**: `README.md`

**Intent**: List the new route.

**Contract**: Auth routes table gains `/collection` — "Kolekcja: browse, edit, delete and tag flashcards (protected)".

### Success Criteria:

#### Automated Verification:

- CI passes on `master` (lint, check, build, smoke)

#### Manual Verification:

- `npx supabase migration list` shows the new migration applied in production
- On production: browse, edit, delete and add/remove a tag on a test card work end to end

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Service: paging range/order/`hasMore`, RPC error mapping (`P0002`, `54000`, other), idempotent tag removal, tag list limit.
- Schemas: edit normalisation and limits, CEFR nullable, tag name rules, offset bounds, UUID check.
- Helpers: `appendPage` dedupe, `withTag`/`withoutTag` dedupe and sort, `mergeTagName` case-insensitive dedupe, `contentProblem` messages (and existing `itemProblem` tests unchanged).

### Integration Tests:

- `npm run check:rls` collection section: tag add create/reuse/idempotence, cross-user isolation, 20-tag limit with no partial writes, link removal keeps tag, cross-user update/delete blocked, duplicate-word edit, paging order within one set.

### Manual Testing Steps:

1. Generate a lesson set of 60+ cards locally, open `/collection`, page through it and confirm order and no duplicates.
2. Edit a card's word with extra spaces and change CEFR; reload and confirm the saved values.
3. Rename a card to another existing word and confirm the duplicate message.
4. Add a new tag, an existing tag in different case, remove a tag; reload and confirm.
5. Delete a card, confirm it is gone after reload and its tag is still suggested on `/add`.

## Performance Considerations

Pages of 50 with embedded tags keep each Worker request small; the tag list is capped at 500 and loaded once per page view. No request per keystroke.

## Migration Notes

Additive only: one new function, no table or data changes. Rollback = drop the function (no data depends on it). Push the migration to production before the code (Phase 4).

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-05)
- PRD: `context/foundation/prd.md` (FR-007, FR-008)
- Contracts: `docs/reference/contract-surfaces.md`
- RPC pattern: `supabase/migrations/20261110221827_flashcard_key_folding.sql` (`save_flashcard`)
- Route pattern: `src/pages/api/profile.ts`, `src/pages/api/proposal-sets.ts`
- Island pattern: `src/components/manual/AddWord.tsx`, `src/components/lesson/ProposalReviewItem.tsx`
- Prior slice plan: `context/archive/2026-11-11-manual-word-ai-fill/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tag RPC and service layer

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset`
- [x] 1.2 Types regenerated and committed: `npm run db:types` produces no diff after commit
- [x] 1.3 RLS and collection checks pass, including the new S-05 section: `npm run check:rls`
- [x] 1.4 Unit tests pass, including the new service tests: `npm test`
- [x] 1.5 Lint and type check pass: `npm run lint` and `npx astro check`

#### Manual

- [ ] 1.6 In local Studio, calling `add_flashcard_tag` as a signed-in user on an own card shows the new tag and link rows

### Phase 2: Collection API

#### Automated

- [ ] 2.1 Unit tests pass, including the collection schema tests: `npm test`
- [ ] 2.2 Lint and type check pass: `npm run lint` and `npx astro check`
- [ ] 2.3 Build passes: `npm run build`

#### Manual

- [ ] 2.4 Against the local dev server, signed in, the endpoints answer as specified
- [ ] 2.5 Signed out, every endpoint returns 401

### Phase 3: "Kolekcja" page

#### Automated

- [ ] 3.1 Unit tests pass, including the collection helper tests and the unchanged review-draft tests: `npm test`
- [ ] 3.2 Lint and type check pass: `npm run lint` and `npx astro check`
- [ ] 3.3 Build passes: `npm run build`
- [ ] 3.4 Smoke test still passes against the local preview: `npm run smoke`

#### Manual

- [ ] 3.5 Signed out, `/collection` redirects to sign-in; the dashboard links to "Kolekcja"
- [ ] 3.6 With more than 50 cards, "Pokaż więcej" loads the next ones without duplicates and disappears at the end
- [ ] 3.7 Edit: content and CEFR change and survive a reload; duplicate word shows the message; "Anuluj" discards
- [ ] 3.8 Delete: confirm removes the card; cancelling keeps it; its tag still appears in suggestions
- [ ] 3.9 Tags: add new, add existing in different case, remove, 21st tag limit all behave as specified
- [ ] 3.10 Empty collection shows the hint with links; layout works on a narrow (mobile) viewport

### Phase 4: Production rollout and docs

#### Automated

- [ ] 4.1 CI passes on `master` (lint, check, build, smoke)

#### Manual

- [ ] 4.2 `npx supabase migration list` shows the new migration applied in production
- [ ] 4.3 On production: browse, edit, delete and add/remove a tag on a test card work end to end
