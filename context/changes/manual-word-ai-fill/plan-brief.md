# Manual Word with AI Fill — Plan Brief

> Full plan: `context/changes/manual-word-ai-fill/plan.md`

## What & Why

Roadmap slice S-04 (FR-006). Not every new word comes from a lesson file: the learner wants to add one word they met, optionally with the sentence it appeared in, and get a ready card (translation in the right meaning, other meanings, example) to review before saving. Ambiguous words ("bank", "get over") are why the context sentence matters.

## Starting Point

Lessons already go through AI generation, a review card, and an accept function that saves cards (one per word) and records outcomes. The AI call, the profile model (S-03), the review card and the save rule are all reusable. What's missing: a single-word prompt, a way to save without a lesson tag, and a way to tell manual outcomes apart from lesson ones.

## Desired End State

- **The flow:** on `/add` ("Dodaj słowo") the user types a word and an optional context and presses "Uzupełnij".
  - A word already in the collection is stopped before any AI call.
  - Otherwise the AI fills a card. A base-form or spelling change is shown ("poprawione z: went").
  - The user edits it, can fill it again with a better context, and saves with an optional tag.
- **The record:** the save writes the card and one outcome row marked `manual`, so S-07 can measure manual fills separately.

## Key Decisions Made

| Decision                                  | Choice                                                                          | Why (1 sentence)                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Placement                                 | New protected `/add` page, linked from the dashboard and "Nowa lekcja"          | A fast single-word flow on a phone, independent of the lesson draft  |
| Word already in the collection            | Stop before the AI call ("To słowo jest już w kolekcji")                        | No paid fill for a card that can't be saved (one word per user)      |
| Normalised word already in the collection | Badge shown, "Zapisz" blocked                                                   | Same rule after the AI turns "went" into an existing "go"            |
| AI may change the word                    | Yes: base form + spelling, shown as "poprawione z: …", editable                 | Cards match lesson cards' base forms, so the duplicate rule works    |
| Tag                                       | Optional, with suggestions                                                      | File a word under a lesson when it came from one, without forcing it |
| Outcome recording                         | Yes, through the same accept path, `source = 'manual'`                          | One save path; S-07 can include or exclude manual fills              |
| `source` column                           | `not null default 'lesson'`, values `lesson`/`manual` (refined from "nullable") | Existing rows get a clear value; S-07 never has to interpret `null`  |
| Fill again                                | Inputs stay editable; "Uzupełnij ponownie" (confirm if edited)                  | Fixing the context is the real lever for ambiguous words             |
| Discarded fill                            | Recorded nowhere                                                                | Only saved cards are outcomes                                        |

## Scope

**In scope:**

- An outcome `source` column, and the accept function with source and an optional tag for manual saves.
- A shared OpenRouter request, the word-fill prompt/schema/parser, and `POST /api/ai/word-fill`.
- The `/add` page.
- Production rollout and docs.

**Out of scope:**

- Editing existing cards (S-05).
- Batch entry.
- Known-words filtering for manual words (FR-015 allows them).
- A model choice on the page.

## Architecture / Approach

Phase 1 changes the data contract:

- `proposal_outcomes.source` is added.
- `accept_proposal_set` is recreated with `p_source default 'lesson'`. Old calls keep working, while manual saves allow no tag and exactly one item.

Phase 2 adds the AI side:

- The OpenRouter call is factored into one internal helper.
- The word fill adds only its prompt, schema and parser.
- The new endpoint checks the collection before and after the fill.

Phase 3 builds the `/add` island:

- It reuses the S-01 review card, without the reject buttons.
- It saves through the existing `POST /api/proposal-sets` with `source: "manual"`.

## Phases at a Glance

| Phase                              | What it delivers                                                | Key risk                                                                                       |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Outcome source and manual saves | Migration, accept function v2, schema/service, check-rls        | Recreating the function breaks lesson saves (mitigated by the defaulted parameter + check-rls) |
| 2. Word fill AI and endpoint       | Shared AI request, word-fill prompt/parser, `/api/ai/word-fill` | Refactoring the shared call regresses lesson generation                                        |
| 3. "Dodaj słowo" page              | `/add` with fill, review, fill again, optional tag, save        | Normalisation edge cases (existing words)                                                      |
| 4. Production rollout and docs     | `db push` before push, docs, CI and production checks           | Code deployed before the migration                                                             |

**Prerequisites:** S-01 and S-03 deployed (done); production `db push` access (the user runs it if the agent is blocked).
**Estimated effort:** about 3 sessions across 4 phases.

## Open Risks & Assumptions

- The AI may "correct" a word the user meant literally. The change is always shown and editable.
- `max_tokens` about 800 is assumed enough for one card; a truncated answer surfaces as a 502 with a retry.
- A long context is capped at 500 characters.

## Success Criteria (Summary)

- A learner adds a word with its context on a phone and gets a correct card in the right meaning within seconds.
- Duplicates are never created and never paid for.
- Manual fills are recorded and distinguishable from lesson proposals.
