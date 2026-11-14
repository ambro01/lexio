# Skip Known Words — Plan Brief

> Full plan: `context/changes/skip-known-words/plan.md`

## What & Why

Roadmap slice S-09 (US-01, FR-015). The app should learn which words the learner already knows. Once a word has been rejected as "Znam / nieprzydatne" or "Za łatwe", it is never proposed again from a later lesson, so each generation spends the learner's attention on new vocabulary.

## Starting Point

S-01 already records every reviewed proposal in `proposal_outcomes`, with the rejection reason and a normalized `word_key`. The table even has an index on `(user_id, word_key)` reserved for this lookup. The proposals route already does a similar post-generation lookup to mark words that are in the collection, so no migration is needed.

## Desired End State

After generating from a lesson (pasted text, a PDF or a scan), proposals for previously known or too-easy words are gone, and the review shows "Pominięto N znanych słów". If everything was known, the notice says so and no draft is created. Words rejected as "Błędne" may come back, and manual word entry still accepts any word.

## Key Decisions Made

| Decision                         | Choice                                                           | Why (1 sentence)                                                                        | Source |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| Where to filter                  | On the server after generation only; the AI prompt is unchanged  | Keeps the quality metric comparable and token cost flat; one indexed query              | Plan   |
| What the learner sees            | A short notice "Pominięto N znanych słów" (no list)              | Explains why a lesson gave fewer words, without UI for an undo the PRD excludes         | Plan   |
| Known word now in the collection | Skipped like any known word (no new lesson tag)                  | One rule, exactly as FR-015 states it                                                   | Plan   |
| Matching                         | `word_key` equality (case and whitespace folded), no inflections | Same rule as collection duplicates; AI proposes base forms                              | Plan   |
| Lookup failure                   | Return proposals unfiltered and log `knownLookup: "failed"`      | A paid generation must never fail on a secondary lookup (same as in-collection marking) | Plan   |
| Notice persistence               | Transient page state, not stored in the review draft             | No draft format change; the notice is informational                                     | Plan   |

## Scope

**In scope:**

- `findKnownWordKeys` in the flashcards service and a pure `dropKnownWords` rule, both with tests.
- Filtering in `POST /api/ai/proposals`, with `meta.skippedKnown` and log fields.
- An S-09 section in `check:rls` and a contract-surfaces row.
- The notice in the lesson generator, README/AGENTS lines, push and a production check.

**Out of scope:**

- AI prompt changes, a list of skipped words, undo, lemma matching.
- Changes to manual word entry, outcome records, the draft format, or a migration.

## Architecture / Approach

```
POST /api/ai/proposals → generateProposals
  → findKnownWordKeys (proposal_outcomes: rejected_known | rejected_too_easy, word_key in …)
  → dropKnownWords → markInCollection → 200 { proposals, meta: { …, skippedKnown } }
LessonGenerator → draft review + "Pominięto N znanych słów"
```

## Phases at a Glance

| Phase                                  | What it delivers                                                          | Key risk                                                    |
| -------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Server-side filter                  | Lookup + pure filter with tests, route wiring, `check:rls` S-09, docs row | Matching differences between AI words and recorded words    |
| 2. Notice in the review and production | Notice in the generator, README/AGENTS, push, production check            | The notice disappearing on reload (accepted: informational) |

**Prerequisites:** S-01 deployed (done); local Supabase for `check:rls`.
**Estimated effort:** about 1 session across 2 phases.

## Open Risks & Assumptions

- A word rejected by mistake can only come back through manual entry (no undo in the MVP, per the PRD).
- Inflected forms are not matched. If the AI proposes "gave up" after "give up" was rejected, it is shown; AI base forms make this rare.
- A known word that is now in the collection does not get the new lesson's tag.

## Success Criteria (Summary)

- A word rejected as known or too easy never shows up again in later lesson proposals; "Błędne" words can.
- The learner sees how many known words were skipped.
- Generation never fails because of the filter, and other users' rejections never affect a user's proposals.
