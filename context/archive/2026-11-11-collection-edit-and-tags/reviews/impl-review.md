<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Collection browse, edit, delete and tags (S-05)

- **Plan**: context/changes/collection-edit-and-tags/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 7 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated re-run on 2026-11-12: `npm run db:types` (no diff), `npm run check:rls`, `npm test` (205), `npm run lint`, `npx astro check`, `npm run build` all pass; CI green on 2072079. `npx supabase db reset` not re-run (would wipe local data); it passed during implementation and in CI.

## Findings

### F1 — Rename across the page boundary makes "Pokaż więcej" skip a card

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/flashcards.service.ts:179-181, src/components/collection/CollectionBrowser.tsx:36-39, src/lib/collection.ts:42-49
- **Detail**: Paging orders by `created_at desc, word_key asc` and requests `offset = cards.length`. A lesson set (up to 150 cards) shares one `created_at`, so its group often straddles the 50-card boundary. Renaming a loaded card so its `word_key` sorts past the boundary shifts later rows up by one; the first unloaded card lands at `offset-1` and is never fetched (it reappears only after a reload). `appendPage` handles the duplicate this causes but not the skip. The plan's "Critical Implementation Details" assumed a rename only causes duplicates — a plan flaw, implemented as written. Same class, narrower: a delete that commits while "Pokaż więcej" is in flight.
- **Fix A ⭐ Recommended**: Tie-break on an immutable column — order `created_at desc, id asc` (service + check-rls paging step + contract doc).
  - Strength: Renames can no longer move a card, so offset = cards.length stays exact; tiny change.
  - Tradeoff: Cards within one lesson are no longer in word order (plan Desired End State / manual 3.6 say "in word order") — order inside a set becomes arbitrary but stable.
  - Confidence: HIGH — `id` is the PK and never changes.
  - Blind spot: The in-flight-delete race remains (separate, very narrow).
- **Fix B**: Accept as a known risk and correct the comment in collection.ts.
  - Strength: Keeps word order within a lesson, no code churn.
  - Tradeoff: A rare silent skip until reload.
  - Confidence: MEDIUM — needs rename + same set + crossing the boundary.
  - Blind spot: How often users rename words in large lessons.
- **Decision**: FIXED (Fix A: tie-break on id; service, test, check-rls, contract doc, appendPage comment)

### F2 — Duplicated request/UI helpers in shared.tsx

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/collection/shared.tsx
- **Detail**: Unplanned (reported adaptation) file; `requestJson`, `Spinner`, `ErrorBox`, `inputClass` re-implement AddWord.tsx's private copies (third copy of `inputClass` with ProposalReviewItem.tsx). Plan excluded refactoring existing code.
- **Fix**: Leave now; later cleanup change moves AddWord onto shared helpers.
- **Decision**: SKIPPED

### F3 — 8 KB PATCH cap comment is wrong for non-Latin scripts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards/[id].ts:12-13, :49
- **Detail**: Content limits allow ~3,100 UTF-16 units; a maxed card in a 3-byte script is ~9.3 KB and gets the generic 400. Polish/English maxes at ~6.2 KB and fits.
- **Fix**: Raise the cap to 16 KB and correct the comment.
- **Decision**: SKIPPED

### F4 — Collection page load failures are not logged

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/collection.astro:15-19
- **Detail**: `.catch(() => null)` swallows the first-page error; the user sees "Nie udało się wczytać kolekcji" with nothing in the Worker logs.
- **Fix**: Log one line `{ event: "collection_page_failed", reason: error.message }` (store errors carry no user content).
- **Decision**: FIXED (log line collection_page_failed in collection.astro)

### F5 — Body cap reads only Content-Length

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards/[id].ts:49, src/pages/api/flashcards/[id]/tags/index.ts:47
- **Detail**: A chunked request without the header (or a non-numeric one) passes the check; only the platform limit applies. Signed-in users only; identical to profile.ts / proposal-sets.ts.
- **Fix**: Accept as existing-pattern risk; a bounded body reader belongs in a shared-helper change.
- **Decision**: ACCEPTED (same Content-Length pattern as existing routes; revisit with a shared bounded-body helper)

### F6 — 22023 / 23514 map to 500 instead of 400

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/flashcards.service.ts:207-211, 243-250
- **Detail**: Unreachable in practice — zod normalises and validates (stricter) before the DB call.
- **Fix**: Skip (defence in depth only).
- **Decision**: SKIPPED

### F7 — No index for the collection order

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261111214624_flashcard_tag_edit.sql (N/A — no index)
- **Detail**: `listFlashcards` sorts by `created_at desc, word_key` per user; only `(user_id, word_key)` is indexed. Fine at MVP scale.
- **Fix**: Add `(user_id, created_at desc, <tie-break>)` index in a later migration if the collection grows.
- **Decision**: SKIPPED

### F8 — Empty-state hint hidden after deleting all loaded cards

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/collection/CollectionBrowser.tsx
- **Detail**: Empty state shows only when `cards.length === 0 && !hasMore`; deleting every loaded card while more exist leaves just "Pokaż więcej". Reasonable behaviour.
- **Fix**: Skip.
- **Decision**: SKIPPED
