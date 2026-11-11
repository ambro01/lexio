# CEFR Level and "Too Easy" Grouping — Plan Brief

> Full plan: `context/changes/cefr-too-easy-grouping/plan.md`

## What & Why

Roadmap slice S-03 (FR-014, FR-016). Lesson material is full of words the learner already knows, which floods the review. With their CEFR level in a profile, the review can put clearly easier words into one collapsed group that is rejected with one tap and recorded as "Za łatwe". The same profile also lets the learner pick which AI model generates their cards.

## Starting Point

S-01 and S-02 are live: paste text or a PDF → AI proposals (each with an AI-estimated CEFR level) → review → accept. The outcome table already allows `rejected_too_easy`, but the review only knows three decisions. There is no profile, and the generation endpoint uses the default model unless a request names one.

## Desired End State

- **Profile:** a `/profile` page stores your level (A1–C2 or unset) and AI model (or the default). Generation uses that model.
- **The group:** with a level set, new proposals rated strictly below your level gather in a collapsed "Za łatwe dla Ciebie (N)" group. You can open it, act on single words as usual, or press "Odrzuć wszystkie jako Za łatwe" (with one "Cofnij").
- **Default fate:** group words you leave alone are saved like the rest.
- **No level:** the review is unchanged, with a hint to set your level.

## Key Decisions Made

| Decision                        | Choice                                                                 | Why (1 sentence)                                                                              |
| ------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Boundary                        | Strictly below your level (at B1: A1/A2 grouped, B1 not)               | Matches the PRD's "below your level"; your own level is where new words appear                |
| Default fate of the group       | Saved like the rest unless bulk-rejected                               | Grouped, never hidden: nothing is recorded as "Za łatwe" without an explicit action           |
| Actions inside the group        | Same as the main list (edit, Znam, Błędne)                             | One review component; keep one word and reject the rest                                       |
| Bulk reject scope               | Only items still accepted and unedited                                 | Your individual decisions are never overwritten                                               |
| No level set                    | No group + hint linking to `/profile`                                  | Never guesses your level                                                                      |
| Profile location                | New protected `/profile` page, linked from the dashboard               | Matches "in their profile"; keeps the lesson form clean                                       |
| Words already in the collection | Never in the group                                                     | Bulk reject must not mark words you are learning as "Za łatwe" (S-09 would hide them forever) |
| Undo                            | One "Cofnij" for the whole bulk reject, plus per-item "Cofnij"         | Undo matches the action; no extra state, since only the bulk action sets "Za łatwe"           |
| Level change during review      | The draft keeps the level it was created with                          | A review never reshuffles under you                                                           |
| Model selection                 | Profile model on the server; the request's explicit `model` still wins | The page sends no model; the measurement script keeps working                                 |
| Draft format                    | v2 with `level`; v1 drafts upgraded as "no level"                      | An open review survives the deploy                                                            |

## Scope

**In scope:**

- `profiles` table + RLS + check-rls, profile service, `POST /api/profile`, the `/profile` page.
- Generation uses the profile model.
- The `reject_too_easy` decision end to end, `isTooEasy`, draft v2, the group UI, the hint.
- Production migration, docs.

**Out of scope:**

- Hiding previously rejected words (S-09), statistics (S-07).
- Prompt/CEFR changes, live regrouping, per-lesson model choice, other profile fields.

## Architecture / Approach

**Phase 1** adds a per-user `profiles` row (level and model, nullable), read and written only through `profiles.service.ts`. It's edited on `/profile` via a JSON endpoint, and read by the generation endpoint for the model.

**Phase 2** keeps the review client-side and pure:

- `isTooEasy` (`src/lib/ai/cefr.ts`) decides membership.
- Draft v2 stores the level and gains `rejectTooEasy` / `undoTooEasy`.
- The fourth decision `reject_too_easy` flows through the existing accept request to the `rejected_too_easy` outcome. No database or accept-function change is needed.

## Phases at a Glance

| Phase                             | What it delivers                                                                   | Key risk                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Profile storage and page       | `profiles` table + RLS, service, endpoint, `/profile`, profile model in generation | RLS mistakes; the profile read failing a paid generation      |
| 2. "Too easy" group in the review | `reject_too_easy` end to end, draft v2, collapsed group, bulk reject + undo, hint  | Draft v1 → v2 upgrade; bulk reject overwriting user decisions |
| 3. Production rollout and docs    | `db push` before push, docs, CI and production checks                              | Code deployed before the migration                            |

**Prerequisites:** S-01 deployed (done); local Supabase for `check:rls`; production `db push` access.
**Estimated effort:** about 3 sessions across 3 phases.

## Open Risks & Assumptions

- The CEFR level is an AI estimate. A misrated word lands in the wrong list, but it's always visible and can be acted on individually.
- `rejected_too_easy` feeds FR-015 (S-09): a bulk reject will later hide those words for good, so the group must be easy to inspect before rejecting.
- The model list may change in configuration. A saved model that's no longer configured falls back to the default silently.

## Success Criteria (Summary)

- A B1 learner sees A1/A2 words in one collapsed group and clears them with one tap, recorded as "Za łatwe".
- The chosen AI model is used for every generation without picking it per lesson.
- Nothing is hidden or recorded as "Za łatwe" without the learner's action.
