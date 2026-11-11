# Paste Text Generation — Plan Brief

> Full plan: `context/changes/paste-text-generation/plan.md`

## What & Why

Roadmap S-01, the north star. A signed-in learner pastes lesson text with a lesson tag name, reviews the AI flashcard proposals (edit, reject as "Znam / nieprzydatne" or "Błędne"), and accepts the set into their collection. This is the flow that the primary success criterion (AI content quality ≥ 75%) is measured on, so every proposal's outcome has to be recorded from day one.

## Starting Point

F-01 delivered AI generation (`POST /api/ai/proposals`, a read-only `/generate` test page). F-02 delivered per-user flashcard storage with `save_flashcard`: an existing word only gains the tag. There is no review UI, no way to save a set and nowhere to record outcomes.

## Desired End State

`/generate` ("Nowa lekcja") takes a tag (with suggestions) and text. It shows a progress counter, then a review list of mobile-friendly cards. Words already in the collection carry a badge and can't be edited. "Akceptuj zestaw" saves all non-rejected proposals with the tag and records every proposal's outcome, in one transaction. The review draft survives reloads.

## Key Decisions Made

| Decision                    | Choice                                                                          | Why (1 sentence)                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Accept the set              | Everything not rejected is saved                                                | Matches the PRD wording and keeps review fast: you only act on the bad ones.                          |
| Saving                      | One SQL function `accept_proposal_set`, one transaction                         | No half-saved sets, one round-trip, and it avoids the known parallel-save deadlock.                   |
| "Corrected" detection       | Client sends AI original + final; server compares after whitespace cleanup      | Nothing is stored before accept; faking your own stats is harmless.                                   |
| Corrected rule              | Any change to word, translation, example or meanings; reverted edit = unchanged | The primary metric needs a precise, testable definition.                                              |
| Words already in collection | Badge "W kolekcji — dostanie tag", editing disabled                             | Edits would be silently lost otherwise.                                                               |
| Model choice                | Default model only, no dropdown                                                 | Model choice belongs in the profile (S-03); the endpoint keeps its optional `model` for measurements. |
| Interrupted review          | Draft in `localStorage`, per user                                               | A paid generation and the review work survive a reload or tab kill.                                   |
| Tag suggestions             | Server-loaded `<datalist>` from `suggestTags`                                   | Prevents tag drift with no new endpoint.                                                              |
| Outcome values              | Include `rejected_too_easy` now                                                 | S-03 then needs no migration; one code path for every rejection.                                      |
| Outcome records             | Append-only (select + insert RLS only)                                          | Stats can't be rewritten after the fact.                                                              |

## Scope

**In scope:**

- `proposal_outcomes` table, `accept_proposal_set` function, RLS checks, contract docs
- Outcome classifier, accept request schema, two service functions, `inCollection` flag on generation, `POST /api/proposal-sets`
- Review UI replacing the spike page, `localStorage` draft, tag suggestions
- Production migration, production run, README/AGENTS updates

**Out of scope:**

- "Too easy" grouping, CEFR and model in profile (S-03); skipping known words (S-09); stats screen (S-07)
- PDF input (S-02), editing existing cards (S-05), rate limiting, streaming, cross-device drafts

## Architecture / Approach

Browser island (`LessonGenerator`) → `POST /api/ai/proposals` (now also marks `inCollection` via one `word_key IN (…)` query) → review state in a pure draft model, persisted to `localStorage` → `POST /api/proposal-sets` → `classifyOutcome()` per item (`src/lib/ai/outcomes.ts`) → `acceptProposalSet()` in `flashcards.service.ts` → `accept_proposal_set` RPC. The RPC calls `save_flashcard` for accepted items and inserts one outcome row per item, all-or-nothing.

## Phases at a Glance

| Phase                                  | What it delivers                                                       | Key risk                                                       |
| -------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Outcome storage and accept function | Table, atomic function, RLS checks, contract docs                      | JSON → SQL array handling inside plpgsql; covered by check-rls |
| 2. Server: rules, service, endpoints   | Classifier, schema, service functions, `inCollection`, accept endpoint | The "corrected" rule must be exact; covered by unit tests      |
| 3. Review UI                           | Lesson flow at `/generate` with persistent draft                       | Review state complexity; kept in a pure, tested module         |
| 4. Production rollout and docs         | Migration on prod before deploy, prod run, docs                        | Pushing code before `db push` would break accept on prod       |

**Prerequisites:** Local Supabase running (stop the simple-calories stack first: port clash); human approval for `npx supabase db push` to production and the push to `master`.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- F-01 is still `in-progress` in the roadmap (reviewed, not archived). S-01 builds on its merged code and does not wait for the archive.
- The "corrected" metric trusts the client's copy of the AI original; acceptable because each user only sees their own stats.
- A draft restored much later may show a stale `inCollection` badge. The save is still correct, because `save_flashcard` merges by word.
- Very long sets (~150 items) call `save_flashcard` 150 times in one transaction; fine at MVP scale, not measured.

## Success Criteria (Summary)

- A user turns pasted lesson text into reviewed flashcards in their collection, tagged with the lesson, on production.
- Every reviewed proposal has exactly one outcome row (unchanged / corrected / rejected with a reason), ready for S-07 and S-09.
- Nothing reaches the collection before "Akceptuj zestaw", and a half-saved set is impossible.
