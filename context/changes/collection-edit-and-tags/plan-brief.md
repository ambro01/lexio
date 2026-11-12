# Collection browse, edit, delete and tags (S-05) — Plan Brief

> Full plan: `context/changes/collection-edit-and-tags/plan.md`

## What & Why

A "Kolekcja" page where the user browses their saved flashcards, fixes their content, deletes them and organises them with tags (a "set" is just a tag). It delivers PRD FR-007 (edit/delete, without changing learning progress) and FR-008 (tags with suggestions of existing ones). S-06 needs this because it reviews cards by tag.

## Starting Point

Cards and tags are saved by `/generate` and `/add`, but the user can't see or change them afterwards. The service already has unused `listFlashcards` / `updateFlashcard` / `deleteFlashcard` / `suggestTags`. The list has no paging (it is silently cut at 1,000 rows), and once a card is saved its tags can't be changed.

## Desired End State

`/collection` (protected, linked from the dashboard) lists cards newest first, 50 at a time with "Pokaż więcej". Each card can be edited in place (word, translation, other meanings, example, CEFR), deleted after a confirm, and tagged with chips that save immediately. Suggestions come from all of the user's tags. A card can have at most 20 tags.

## Key Decisions Made

| Decision           | Choice                                                               | Why (1 sentence)                                                               |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Paging             | 50 server-rendered + "Pokaż więcej" (newest first, ties by word)     | Fast first paint and simple paging; ties by word keep a lesson's cards stable. |
| Editable fields    | Content + CEFR (incl. "brak")                                        | Lets the user fix a wrong AI level that S-03 / S-09 rely on.                   |
| Tag editing        | Chips that save immediately (add/remove per request)                 | Tagging many cards is quick and doesn't need edit mode.                        |
| Tag add mechanism  | New RPC `add_flashcard_tag` (create-if-missing + link, ≤20 per card) | One atomic call, like `save_flashcard`; the limit is enforced in the database. |
| Suggestions        | All of the user's tags (up to 500) loaded once into a `<datalist>`   | No request per keystroke; same pattern as `/add`.                              |
| Tags with no cards | Kept                                                                 | Matches the existing "tags stay" contract; no new rules.                       |
| Delete             | `window.confirm`, permanent; tags and outcome records stay           | Simple and matches the existing confirm pattern.                               |
| AI quality rate    | Edits/deletes write nothing to `proposal_outcomes`                   | S-07 measures quality as judged at review time; outcomes stay append-only.     |
| Edit validation    | Reuse the review's `contentSchema` / normalisation                   | A saved card obeys the same limits as a newly accepted one.                    |

## Scope

**In scope:**

- `add_flashcard_tag` migration, paged list, tag add/remove/list in the service, RLS checks
- API: list, edit, delete, add/remove card tag
- `/collection` page with list, paging, in-place edit, delete, tag chips; dashboard link
- Production migration push, README route

**Out of scope:**

- Search/filter by tag (FR-009, parked), other sort options
- Renaming, merging or deleting tags; bulk actions; undo after delete
- Any write to `proposal_outcomes`; learning progress (S-06)

## Architecture / Approach

Astro page server-renders the first 50 cards and the tag list → React island holds loaded cards in memory → per-action JSON calls to `/api/flashcards…` routes → `flashcards.service.ts` → Supabase (plain table calls under RLS; tag add via the new `security invoker` RPC).

## Phases at a Glance

| Phase                          | What it delivers                                                 | Key risk                                     |
| ------------------------------ | ---------------------------------------------------------------- | -------------------------------------------- |
| 1. Tag RPC and service layer   | `add_flashcard_tag`, paged list, tag add/remove/list, RLS checks | Getting RPC error codes and isolation right  |
| 2. Collection API              | GET list, PATCH/DELETE card, POST/DELETE card tag                | Non-UUID ids or bad input leaking as 500s    |
| 3. "Kolekcja" page             | Island with paging, in-place edit, delete, tag chips             | Per-card request state and paging duplicates |
| 4. Production rollout and docs | Migration in production before code; README                      | Deploying code before the migration          |

**Prerequisites:** F-02 and S-01 done (they are); local Supabase stack running.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- The 20-tag limit is a soft check; two concurrent adds could exceed it by one (acceptable).
- Offset paging can show a card twice or shift after a rename; the client drops duplicates by id.
- Users with 500+ tags see only the first 500 alphabetically in suggestions.

## Success Criteria (Summary)

- The user can find any of their cards by paging, edit or delete it, and the change survives a reload.
- Tags can be added (new or existing, with suggestions) and removed per card instantly, without duplicates.
- `check:rls`, unit tests, lint, type check, build and smoke pass; it works in production.
