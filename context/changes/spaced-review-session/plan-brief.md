# Spaced-Repetition Review Session — Plan Brief

> Full plan: `context/changes/spaced-review-session/plan.md`
> Research: `context/changes/spaced-review-session/research.md`

## What & Why

Roadmap slice S-06 (FR-010, FR-011) is the second half of the product loop: practising the flashcards that the lesson flow creates. The learner reviews by tag (e.g. one lesson) or across the whole collection with a card limit. They rate each card "Nie pamiętam", "Trudne" or "Łatwe", and an existing spaced-repetition method decides when each card comes back, so weaker cards return more often. "Opanowane" takes a card out of the general review without deleting it.

## Starting Point

No review exists today: there is no due date, progress or mastered flag anywhere in the schema. F-02 deferred them to this slice and only added an index for review-by-tag. Flashcard edits already write content columns only, so progress can be kept apart from content.

## Desired End State

A "Powtórka" link on the Dashboard leads to `/review`. There the learner picks "Ogólna" or "Według tagu" and a limit (default 20, remembered in the browser), then goes through the cards. Each card shows the English word; "Pokaż" reveals the translation, the meanings and the example. Each rating is saved at once and reschedules the card with FSRS, and "Nie pamiętam" brings the card back at the end of the session. A summary closes the session. The Collection shows an "Opanowane" badge and a toggle on each card.

## Key Decisions Made

| Decision             | Choice                                                                                                                          | Why (1 sentence)                                                                        | Source          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------- |
| Method               | FSRS via `ts-fsrs` 5.4.2 (pinned), default parameters, fuzz on                                                                  | Existing, maintained, dependency-free; the stable API rather than the 2-week-old v6     | Research + Plan |
| Button mapping       | Nie pamiętam → Again, Trudne → Hard, Łatwe → Good                                                                               | Good is the default "remembered" answer; Easy would stretch intervals and cut retention | Plan            |
| Storage              | Separate `review_states` (1:1 with each card) + `review_log` (one row per rating), cascading on delete                          | "Last edited" stays true; history enables undo, stats and optimization later            | Plan            |
| General selection    | Due cards (oldest due first), then new cards (oldest first), up to N; mastered excluded; no review-ahead                        | Anki-like; new lesson cards enter review without a separate mode                        | Plan            |
| Tag selection        | All cards of the tag, mastered included: due, then new, then the rest by nearest due; same limit                                | "Review this lesson" always works; ratings still reschedule                             | Plan            |
| Session limit        | Field on the start screen, 1–100, default 20, remembered in localStorage                                                        | No profile or schema change                                                             | Plan            |
| Same-session re-show | "Nie pamiętam" re-queues the card at the end until it gets another rating; every rating is saved                                | A forgotten word is consolidated at once, as in Anki                                    | Plan            |
| Opanowane            | Button in the session (removes the card, no rating) plus a badge and toggle in the Collection; FSRS state is kept               | Mark where you see it, undo in one place; scheduling resumes after unmarking            | Plan            |
| Where FSRS runs      | On the server per rating; selection is one SQL RPC; writes are one atomic RPC with an optimistic `reps` check (409 on conflict) | One clock and one source of truth; a double tap cannot apply two ratings                | Plan            |
| Due boundary         | `due <= now()` in UTC                                                                                                           | Simplest correct rule; no local-day logic                                               | Plan            |
| Card direction       | Front: English word; back: Polish translation, meanings, example                                                                | Matches the English→Polish cards; the PRD does not specify a direction                  | Plan            |

## Scope

**In scope:**

- A migration with 2 tables, RLS and 3 RPCs (`review_queue`, `record_review`, `set_flashcard_mastered`).
- The scheduler module and review service, with tests.
- An S-06 section in `check:rls`.
- Three API routes, the mastered flag in Collection data, the `/review` page and session island, and the Collection toggle.
- Docs and the production rollout.

**Out of scope:**

- FSRS optimization, v6/FSRS-7, SM-2, a fourth button or review-ahead.
- A profile session limit, undo, statistics (FR-012) or resuming an interrupted session.
- A local-day "due today", the reverse direction, typing answers or audio.

## Architecture / Approach

```
/review (Astro, tags loaded on server) → ReviewSession island
  Zacznij → POST /api/review/session → review.service → RPC review_queue (SQL ordering + limit)
  rating  → POST /api/review/rate    → read state → scheduleReview (ts-fsrs) → RPC record_review (state + log, reps check)
  Opanowane → PUT /api/flashcards/[id]/mastered → RPC set_flashcard_mastered
Collection list embeds review_states(mastered_at) → badge + toggle
```

## Phases at a Glance

| Phase                                  | What it delivers                                                                      | Key risk                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Review data and scheduler           | Migration, types, FSRS scheduler, review service, `check:rls` S-06, contract docs     | Queue ordering in SQL; ts-fsrs Worker CPU (guarded by a timing test) |
| 2. Review API                          | Session, rate and mastered routes; mastered flag in Collection data                   | Conflict handling (409) and keeping the edit path untouched          |
| 3. Review screen and Collection toggle | `/review` start screen, session with re-show and summary, Collection badge and toggle | Comfort on mobile                                                    |
| 4. Docs and production rollout         | README/AGENTS, production migration before code, phone session                        | Code reaching production before the migration                        |

**Prerequisites:**

- F-02 and S-01 (done).
- Local Supabase running for `db reset` and `check:rls`.
- The user applies the production migration in their own terminal.

**Estimated effort:** about 3–4 sessions across 4 phases.

## Open Risks & Assumptions

- ts-fsrs CPU cost in workerd is unmeasured (it is pure arithmetic). The phase 1 timing test and the phase 4 Workers logs check it.
- Default FSRS parameters may not fit one learner perfectly. The review log keeps optimization possible later.
- The user might press "Trudne" after forgetting, which inflates intervals. The button carries the hint "pamiętam, z trudem".

## Success Criteria (Summary)

- On a phone, the learner can review a lesson by tag or the whole collection, rating cards with three buttons, and weak cards come back sooner.
- "Opanowane" removes a card from general review and can be undone in the Collection; editing a card never changes its schedule.
- Every user's review data stays isolated (`check:rls`), and the Worker stays within the Free-plan CPU limit.
