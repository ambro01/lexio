# Skip Known Words Implementation Plan

## Overview

Roadmap slice S-09 (US-01, FR-015). When proposals are generated from a lesson (pasted text, a PDF or a scan), the server drops every proposal whose word the user has ever rejected as "Znam / nieprzydatne" or "Za łatwe". The review then shows how many were skipped.

Words rejected as "Błędne" may come back. Adding a word manually (S-04) is unaffected.

## Current State Analysis

- Every reviewed AI proposal leaves a row in `proposal_outcomes`, with `outcome` in `rejected_known` / `rejected_too_easy` / `rejected_wrong` / `accepted_*`.
  - For rejected items the row stores the AI's original word (`supabase/migrations/20261110224353_proposal_outcomes.sql:10-27`, `:51-57`).
  - `word_key` is generated with the same folding as `flashcards.word_key` (`:16-17`).
  - An index on `(user_id, word_key)` was added for exactly this lookup (`:33-34`).
  - RLS lets users select only their own rows (`:41-48`).
- `POST /api/ai/proposals` generates proposals, then marks the ones already in the collection with one `in(word_key, …)` query (`findExistingWordKeys`, `src/lib/services/flashcards.service.ts:158-169`).
  - A lookup failure never fails the paid generation: `markInCollection` reports `lookup: "failed"` instead (`src/pages/api/ai/proposals.ts:41-63`, `:120-134`).
- `LessonGenerator.generate()` turns the response into a review draft and shows `NO_PROPOSALS` when the list is empty (`src/components/lesson/LessonGenerator.tsx:194-216`).
- The word-fill route (`src/pages/api/ai/word-fill.ts`) is separate and stays untouched (FR-015: manual entry stays allowed).
- No migration is needed: the table, column and index exist.

## Desired End State

Generating proposals from a lesson never shows a word the user rejected earlier as "Znam / nieprzydatne" or "Za łatwe". This holds even if that word was later added to the collection manually.

When words were skipped, the review shows "Pominięto N znanych słów" above the proposals. When every proposal was skipped, the notice reads "AI nie znalazło nowych słów — pominięto N znanych." and no draft is created.

Words rejected as "Błędne" still appear. If the known-words lookup fails, proposals come back unfiltered and the `ai_generation` log line records the failure.

### Key Discoveries:

- The rejection rows store the AI's original word and its `word_key`, which matches the folding of `toKey` (`flashcards.service.ts:97-99`). Matching proposal words by key is therefore exact for case and whitespace, but not for inflections ("give up" vs "gave up"). AI proposals use base forms, so this is enough.
- `accept_proposal_set` records `rejected_too_easy` for bulk "Za łatwe" rejections (S-03), so both reasons live in the same table.

## What We're NOT Doing

- No hint or known-words list in the AI prompt. The prompt and the quality metric stay unchanged.
- No list of the skipped words and no undo (PRD: manual entry is the workaround).
- No exception for known words that are now in the collection: they are skipped too, so their card does not get the new lesson tag.
- No change to manual word entry (S-04), to generation itself, to the outcome records, or to the stored review draft format.
- No lemma or inflection matching; only `word_key` equality.
- No migration.

## Implementation Approach

Filter on the server, right after generation and before the in-collection marking, with one indexed query, following the `markInCollection` pattern. The filter is a pure function, so the rule is unit-tested without a database. The skipped count travels in `meta` and is shown as a transient notice. It is not stored in the draft, so the draft format does not change.

## Phase 1: Server-side filter

### Overview

`POST /api/ai/proposals` drops known words and reports how many it dropped. No UI change yet.

### Changes Required:

#### 1. Known-words lookup

**File**: `src/lib/services/flashcards.service.ts`, `src/lib/services/flashcards.service.test.ts`

**Intent**: Return the keys of the given words that the user has rejected as known or too easy. It mirrors `findExistingWordKeys`.

**Contract**:

- `findKnownWordKeys(client, words: string[]): Promise<Set<string>>`.
- Keys come from `toKey`, deduplicated, with empty keys dropped; with no keys it returns an empty set without a query.
- The query is `from("proposal_outcomes").select("word_key").in("outcome", ["rejected_known", "rejected_too_easy"]).in("word_key", keys)`.
- Errors go through `storeError("known word lookup", …)`.
- Tests use the stub client: the table, both `in` filters, deduplication, the empty input path and the error mapping.

#### 2. Filter rule

**File**: `src/lib/ai/known-words.ts` (new), `src/lib/ai/known-words.test.ts` (new)

**Intent**: One pure function that applies FR-015 to a proposal list.

**Contract**:

- `dropKnownWords<T extends { word: string }>(proposals: T[], knownKeys: Set<string>): { kept: T[]; skipped: number }`.
- It compares by `toKey` (imported from a pure place; if `toKey` lives in the service module, move or re-export it so this module has no Supabase import).
- Order is preserved.
- Tests:
  - case and whitespace variants are skipped;
  - an unknown word is kept;
  - order is preserved;
  - the empty set keeps everything;
  - the count is correct.

#### 3. Route

**File**: `src/pages/api/ai/proposals.ts`

**Intent**: Apply the filter after `generateProposals` and before `markInCollection`, without ever failing the paid generation.

**Contract**:

- A helper `skipKnownWords(proposals, client)` returns `{ proposals, skipped, lookup: Lookup }`.
  - When there is no client, `lookup` is `"unavailable"` and nothing is filtered.
  - When the lookup throws, `lookup` is `"failed"` and nothing is filtered.
- The 200 response `meta` gains `skippedKnown: number`.
- The `ai_generation` log line gains `skippedKnownCount` and `knownLookup`.
- `proposalCount` in the log is the count after filtering.

#### 4. Checks and docs

**File**: `scripts/check-rls.mjs`, `docs/reference/contract-surfaces.md`

**Intent**: Prove the lookup's semantics and isolation against local Supabase, and record the new service function.

**Contract**:

- A new S-09 section of `step(...)` checks, using `acceptSet`:
  - A records outcomes for words rejected as `rejected_known`, `rejected_too_easy` and `rejected_wrong`, plus one accepted word.
  - A's lookup (the same query as the service, inlined in the script) returns exactly the known and too-easy keys.
  - B's same query returns none.
- `contract-surfaces.md` gains a service row for `findKnownWordKeys` and notes `proposal_outcomes.word_key` as relied on by S-09.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- RLS and outcome checks pass, including the new S-09 section: `npm run check:rls`
- Build passes: `npm run build && npm run check:client-only`

#### Manual Verification:

- In dev:
  1. Generate from a short text containing a word.
  2. Reject that word as "Znam / nieprzydatne" and accept the set.
  3. Generate again from the same text.

  The response `meta.skippedKnown` is at least 1 and the word is absent. A word rejected as "Błędne" in the same set still appears.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Notice in the review and production

### Overview

The learner sees how many known words were skipped, the docs describe the rule, and it runs in production.

### Changes Required:

#### 1. Notice

**File**: `src/components/lesson/LessonGenerator.tsx`

**Intent**: Show the skipped count after a generation without changing the stored draft.

**Contract**:

- `GenerationResponse.meta` gains an optional `skippedKnown?: number`; the type guard tolerates its absence.
- After a successful generation:
  - if `skippedKnown > 0` and proposals remain, keep a transient `skippedNotice` state "Pominięto N znanych słów", shown above the draft review;
  - if no proposals remain and `skippedKnown > 0`, the empty-state notice reads "AI nie znalazło nowych słów — pominięto N znanych.";
  - otherwise the existing `NO_PROPOSALS` applies.
- The notice clears when the draft is accepted or discarded, or when a new lesson starts. It is not restored on reload; that is acceptable because it is informational.
- Polish plural forms are not required. Use the fixed wording "Pominięto N znanych słów" (consistent with existing count texts like "N słów").

#### 2. Docs

**File**: `README.md`, `AGENTS.md`

**Intent**: Document the rule where generation is described.

**Contract**:

- README: one sentence in the generation description saying that words rejected as known or too easy are not proposed again.
- AGENTS.md: in the scope paragraph, the same rule with a pointer to `findKnownWordKeys` and `dropKnownWords`, and that word-fill is exempt.

### Success Criteria:

#### Automated Verification:

- Unit tests, lint and type check pass: `npm test`, `npm run lint`, `npx astro check`
- Build passes: `npm run build && npm run check:client-only`
- CI passes on `master` after push

#### Manual Verification:

- Dev: a regenerated lesson shows "Pominięto N znanych słów" above the review, and the notice is gone after "Odrzuć szkic".
- Production, after push: a lesson containing a word previously rejected as "Znam / nieprzydatne" does not propose it, and the notice shows the count.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `known-words.ts`: case and whitespace variants skipped, unknown kept, order preserved, empty set, count.
- `flashcards.service.ts` `findKnownWordKeys`: query shape (table, outcome filter, key filter), deduplication, empty input without a query, error mapping.

### Integration Tests:

- `check:rls` S-09 section: known/too-easy keys returned, "Błędne" and accepted not returned, other users see nothing.

### Manual Testing Steps:

1. Dev: generate, reject a word as "Znam", accept, generate again: the word is skipped and `skippedKnown` ≥ 1.
2. Dev: a word rejected as "Błędne" comes back.
3. Dev: the notice is shown and clears on discard.
4. Production: a previously known word is skipped and the notice is shown.

## Performance Considerations

One extra indexed query per generation (`proposal_outcomes (user_id, word_key)`), with at most ~150 keys in the `in` list. It is I/O, not Worker CPU.

## Migration Notes

None. The table, column and index exist since S-01.

## References

- PRD FR-015 (`context/foundation/prd.md:92-93`), US-01 criterion (`:63`)
- `supabase/migrations/20261110224353_proposal_outcomes.sql`
- `src/pages/api/ai/proposals.ts:41-63` (`markInCollection` pattern), `src/lib/services/flashcards.service.ts:158-169`
- `src/components/lesson/LessonGenerator.tsx:194-216`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server-side filter

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — fe756bc
- [x] 1.2 Lint and type check pass: `npm run lint` and `npx astro check` — fe756bc
- [x] 1.3 RLS and outcome checks pass, including the new S-09 section: `npm run check:rls` — fe756bc
- [x] 1.4 Build passes: `npm run build && npm run check:client-only` — fe756bc

#### Manual

- [x] 1.5 Dev: a word rejected as "Znam" is skipped on regeneration (meta.skippedKnown ≥ 1); a "Błędne" word still appears — fe756bc

### Phase 2: Notice in the review and production

#### Automated

- [x] 2.1 Unit tests, lint and type check pass: `npm test`, `npm run lint`, `npx astro check` — 711761f
- [x] 2.2 Build passes: `npm run build && npm run check:client-only` — 711761f
- [x] 2.3 CI passes on `master` after push — 711761f

#### Manual

- [x] 2.4 Dev: the notice shows the skipped count and clears after discarding the draft — 711761f
- [x] 2.5 Production: a previously known word is not proposed and the notice shows the count — 711761f
