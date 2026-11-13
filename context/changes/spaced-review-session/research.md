---
date: 2026-11-13T20:46:09+01:00
researcher: Claude (Opus 5.5) for Rafal A
git_commit: fa6581281aedb8a4c8ab5428005036b7dd3f807a
branch: master
repository: lexio
topic: "What does S-06 spaced-review-session need: which existing SRS method and library, what state to store, how to select cards, and where it plugs into the codebase?"
tags: [research, codebase, spaced-repetition, fsrs, ts-fsrs, review, supabase, rls, spaced-review-session]
status: complete
last_updated: 2026-11-13
last_updated_by: Claude (Opus 5.5)
---

# Research: Spaced-repetition review session (S-06)

**Date**: 2026-11-13T20:46:09+01:00
**Researcher**: Claude (Opus 5.5) for Rafal A
**Git Commit**: fa6581281aedb8a4c8ab5428005036b7dd3f807a
**Branch**: master
**Repository**: lexio

## Research Question

Roadmap slice S-06 `spaced-review-session` (FR-010, FR-011): the user starts a review **by tag**, or a **general** review with a card limit. They rate each card "Nie pamiętam", "Trudne" or "Łatwe", mapped onto an **existing** spaced-repetition method. Separately, they can mark a card "Opanowane": excluded from general review, kept in tag review, reversible. Card selection and order follow the algorithm, "so weaker cards appear more often".

Questions:

1. Which existing method and library fit, and how do the three ratings map?
2. What state must be stored, and where?
3. How should cards be selected in each mode?
4. Where does it plug into the code, given the Workers Free plan?
5. What is still undecided?

The roadmap names question 1 as the open unknown, owned by the user and decided in `/10x-plan` (`context/foundation/roadmap.md:180`).

## Summary

- **Nothing for review exists yet.** No migration or generated type has a due date, interval, stability, reps, mastered flag or review log. This was checked across all 7 migrations in `supabase/migrations/` and `src/db/database.types.ts`. F-02 explicitly deferred "review-scheduling state" and "Opanowane" to S-06 (`context/archive/2026-11-10-flashcard-data-contract/plan.md:41`). The one review-ready piece is the `flashcard_tags(tag_id)` index, commented "Review-by-tag lookups" (`supabase/migrations/20261110210825_flashcard_data_contract.sql:51-52`).
- **No method has been chosen yet.** The PRD requires an existing, not self-designed, method (`prd.md:112`, `:156`; `shape-notes.md:46`). No file in `context/` names FSRS, SM-2 or Leitner.
- **Recommended method (inference): FSRS via `ts-fsrs` 5.4.2**, mapping:
  - "Nie pamiętam" → `Again`
  - "Trudne" → `Hard`
  - "Łatwe" → `Good`

  Reasons:
  - ts-fsrs is MIT-licensed, has zero runtime dependencies (`engines node >=20`), and is actively maintained.
  - A static scan of `dist/index.mjs` found no `require(`, `node:` import or `process.` use; the one hit was the word "process." in a doc comment.
  - Anki documents Hard as "a passing grade" and Good as the default button, so "Łatwe" → Good keeps retention at the target; Easy would push intervals out.
  - The npm `latest` tag is **6.0.0** (FSRS-7, a new API, published 2026-10-28), so pinning 5.x is a deliberate stability choice.

- **Weaker cards come back more often by the algorithm itself:** Again triggers a minutes-long relearning step and lowers stability, and Hard schedules a shorter interval than Good. No extra weighting is needed (FSRS behaviour, see Detailed Findings §1).
- **Edits already leave progress alone.** `updateFlashcard` copies only `word`, `translation`, `additional_meanings`, `example_sentence` and `cefr` (`src/lib/services/flashcards.service.ts:195-200`), so new progress columns would not be touched by an edit (PRD rule at `prd.md:100`). One side effect remains: the `flashcards_set_updated_at` BEFORE UPDATE trigger bumps `updated_at` on any update. If progress columns live on `flashcards`, every rating changes `updated_at`, which today means "last edited". A separate table avoids that.
- **The server-side scheduler fits the Free plan (inference):** one `next()` call is a handful of `exp`/`pow` operations, and the DB round-trip is I/O, not CPU. **Not measured:** running the downloaded package to benchmark it was blocked in this session.
- **Decisions left for the plan:**
  - where the state lives (columns vs a separate table);
  - whether to keep a review log;
  - the selection rules (new cards, tag mode with or without mastered cards, review-ahead);
  - the session limit (default and where it is stored);
  - same-session re-show after "Nie pamiętam";
  - the time-zone boundary.

## Detailed Findings

### 1. Method, library and rating mapping

| Method  | 3-button mapping     | Stored state per card                                                                                | Library                                                                               | Notes                                                  |
| ------- | -------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| FSRS-6  | Again / Hard / Good  | due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review (+ log) | `ts-fsrs` 5.4.2, MIT, 0 deps, ~13.5 KB gzipped (worker measurement)                   | Recommended; default parameters used without optimizer |
| FSRS-7  | same                 | v6 model fields                                                                                      | `ts-fsrs` 6.0.0 (npm `latest`), new API, depends on `@open-spaced-repetition/srs-kit` | Two weeks old at research time                         |
| SM-2    | q 1 / 3 / 5 (or 4)   | interval, repetition, efactor, due                                                                   | `supermemo` 2.0.23 (MIT, last published 2025-03-20)                                   | Simple, weaker model                                   |
| Leitner | box down / stay / up | box, due                                                                                             | none                                                                                  | Crudest; no canonical spec                             |

Sources:

- ts-fsrs npm registry (`npm view ts-fsrs dist-tags license` → `latest: 6.0.0`, `MIT`; `ts-fsrs@5.4.2 engines node >=20.0.0`), checked 2026-11-13.
- ts-fsrs 5.4.2 README: https://github.com/open-spaced-repetition/ts-fsrs/blob/v5.4.2/README.md
- Anki studying docs (Hard/Good semantics): https://docs.ankiweb.net/studying.html
- Anki deck options (FSRS, Hard is a passing grade, review order by retrievability): https://docs.ankiweb.net/deck-options.html
- SM-2: https://super-memory.com/english/ol/sm2.htm

ts-fsrs 5.4.2 defaults, read from `dist/index.mjs:503-511`:

- `request_retention` 0.9
- `maximum_interval` 36500
- `enable_fuzz` false
- `enable_short_term` true
- default learning steps 1m/10m and relearning steps 10m (as reported by the external worker from the README)

API (v5): `fsrs(generatorParameters({...}))`, `createEmptyCard(now)`, `f.next(card, now, Rating.X)` → `{ card, log }`, `f.repeat(card, now)` (previews of all ratings), `f.get_retrievability(card, now)`, `f.rollback(card, log)`.

UI risk (inference): the user must read "Trudne" as "remembered, with effort". Pressing it after forgetting inflates intervals (Anki deck-options docs). A one-line hint on the button would help.

FSRS parameter optimization needs a few hundred reviews (Anki docs). The MVP would run on default parameters, which are trained on a large population.

### 2. Data model today and where review state can live

- `flashcards` columns (`20261110210825_flashcard_data_contract.sql:10-25`):
  - `id`, `user_id` (default `auth.uid()`, cascade)
  - `word`, `word_key` (generated)
  - `translation`, `additional_meanings text[]`, `example_sentence`, `cefr`
  - `created_at`, `updated_at`

  Constraints: unique `(user_id, word_key)` and unique `(id, user_id)`, which serves the composite foreign keys.

- `flashcard_tags`: PK `(flashcard_id, tag_id)`, `user_id`, composite foreign keys with cascade, and an index on `tag_id` (`:39-52`).
- RLS template: one policy per operation, `to authenticated`, `user_id = (select auth.uid())`, nothing for anon (`:80-129`). The rule "migrations are additive, RLS per operation, manual `db push` before code" is in `AGENTS.md:7`.
- RPC template: `plpgsql security invoker set search_path = ''`, SQLSTATE errors (`22023`, `P0002`, `54000`), `revoke … from public, anon; grant … to authenticated` (`20261111214624_flashcard_tag_edit.sql:15-83`).
- Two options for the plan:
  - **(a) Columns on `flashcards`:** simplest queries. Each rating bumps `updated_at` through the trigger, and the edit whitelist already keeps edits away from the new columns.
  - **(b) A `card_reviews`/`flashcard_progress` table, 1:1 with a cascade on delete:** keeps `updated_at` meaning "last edited" and isolates review writes. It needs a join or an upsert, plus a new `TABLES` entry and steps in `scripts/check-rls.mjs`.
- A review log (`review_log`: card, rating, state, due, stability, difficulty, scheduled_days, reviewed_at) is optional for the MVP:
  - No requirement needs it. FR-012 statistics are out of MVP (`prd.md:163`), and S-07 reads only `proposal_outcomes` (`roadmap.md:193`).
  - It would enable undo (`rollback`), later statistics and FSRS optimization. Cost: one INSERT per rating.
- "Opanowane" maps onto Anki's suspend semantics (hidden from review until manually unsuspended, https://docs.ankiweb.net/studying.html). The model is a `mastered_at timestamptz null` (or boolean) flag that general selection excludes. Keeping the FSRS state unchanged lets un-mastering resume scheduling.

### 3. Card selection per mode (inference, grounded in Anki behaviour)

- General mode with limit N:
  1. Non-mastered cards with `due <= now`, ordered by `due` ascending. Anki also offers "ascending retrievability", which needs app-side computation.
  2. Fill with new cards (never reviewed), ordered by `created_at`.
  3. Optionally, not-yet-due cards ("review ahead"); FSRS handles early reviews through elapsed time.
- Tag mode: the tag's cards, due first, then new, then the rest. Whether mastered cards are included is a product choice: the PRD only says they stay in tag review (`prd.md:112`). In Anki's default filtered-deck behaviour, ratings given in a tag session reschedule the card (https://docs.ankiweb.net/filtered-decks.html).
- New cards: at 20–50 new cards a week, a separate new-card limit may not be needed. The PRD says nothing about one.
- Session limit: the PRD requires "a user-set limit" in general mode (`prd.md:110`). No default or maximum is recorded, and `profiles` has no column for it (`20261111144401_profiles.sql:10-15`). It could be set per session or stored in the profile.

### 4. Where it plugs in

- **Scheduler on the server, per rating request (inference):** load the card state, call `next`, then update the state (and insert a log row). This keeps one clock and one library version. Running it in the browser is possible for a single user but splits the source of truth.
- **API pattern:** authenticated JSON routes follow 401 → 404 for an invalid UUID → 415 → `Content-Length` cap → zod → 503 when there is no client → service errors mapped to 404/409/500 → one structured log line without words or IDs (`src/pages/api/flashcards/[id].ts:26-89`).
- **Page:** a new `/review` page needs:
  - an entry in `PROTECTED_ROUTES` (`src/middleware.ts:4`);
  - a dashboard link (`src/pages/dashboard.astro:17-30`);
  - an Astro page loading data on the server plus a React island, following `src/pages/collection.astro:12-56` and `src/components/collection/shared.tsx` (`requestJson`, `ErrorBox`, `Spinner`).
- **Naming collision risk:** `src/lib/review-draft.ts` and `useReviewDraft` belong to the AI **proposal** review (storage key `lexio:review-draft:${userId}`, `review-draft.ts:224-226`). Spaced-review code needs distinct names and keys.
- **Docs and scripts touched by a schema change:**
  - `scripts/check-rls.mjs`: the `TABLES` array and per-slice steps (`:13`, `:171`, `:230`);
  - `docs/reference/contract-surfaces.md`;
  - the README route table (`README.md:151-164`) and `AGENTS.md`;
  - `npm run db:types` after the migration.
- **Production migrations:** the user applies them by hand before code is pushed (`context/deployment/deploy-plan.md:58-61`).
- **Mobile:** the NFR asks that review be comfortable on recent mobile browsers (`prd.md:132`). The app has no touch- or swipe-specific code today, only the responsive layout (`src/layouts/Layout.astro:17`).

### 5. Time and sessions

- No rule exists about time zones or "due today" (searched `context/foundation/*`, `context/archive/**`). Options:
  - store UTC timestamps and compare `due <= now()`;
  - or use "due before the start of the next local day" (Europe/Warsaw) for an Anki-like daily view.
- Same-session re-show: with `enable_short_term` on (the 5.4.2 default), "Nie pamiętam" schedules a step of minutes. The simplest MVP options:
  - re-queue the card once at the end of the client session;
  - or turn short-term off so intervals are whole days.
- Offline mode is a Non-Goal (`prd.md:167`).

## Code References

- `supabase/migrations/20261110210825_flashcard_data_contract.sql:10-25`: `flashcards` table
- `supabase/migrations/20261110210825_flashcard_data_contract.sql:51-52`: index for review-by-tag
- `supabase/migrations/20261111214624_flashcard_tag_edit.sql:15-83`: RPC template
- `supabase/migrations/20261111144401_profiles.sql:10-15`: `profiles` (no session-limit column)
- `src/lib/services/flashcards.service.ts:195-200`: edit whitelist (progress-safe)
- `src/lib/services/flashcards.service.ts:179-182`: paging/order pattern
- `src/pages/api/flashcards/[id].ts:26-89`: authenticated route pattern
- `src/middleware.ts:4`: `PROTECTED_ROUTES`
- `src/pages/collection.astro:12-56`, `src/components/collection/shared.tsx`: page and island pattern
- `src/lib/review-draft.ts:224-226`: proposal-review storage key (name collision to avoid)
- `scripts/check-rls.mjs:13`: `TABLES` array for RLS checks

## Architecture Insights

- The schema convention is additive migrations with per-operation RLS, composite foreign keys with `(id, user_id)` and cascades, and SQLSTATE-coded RPC errors. Review state should follow it, so the existing RLS script can cover it.
- Scheduling is a pure function of (card state, rating, now), which makes it testable in Vitest with fixed dates and no database.
- The edit path is already isolated from progress, so the PRD rule "editing does not change learning progress" holds by construction, provided the new state is never part of `editRequestSchema` (`src/lib/collection.ts:19`).

## Historical Context (from prior changes)

- `context/archive/2026-11-10-flashcard-data-contract/plan.md:41`: "No review-scheduling state, no 'Opanowane' flag (S-06)". Supported; still true today.
- `context/archive/2026-11-10-flashcard-data-contract/plan.md:77`: `tag_id` index for review-by-tag. Supported; the index exists.
- `context/archive/2026-11-11-collection-edit-and-tags/plan.md:42`: S-05 avoided coupling to review state. Supported; the edit whitelist confirms it.
- `context/foundation/shape-notes.md:46-47`: "gotowy algorytm", with "opanowane" first imagined as an option next to the rating. The PRD later split it out into a separate mark (`prd.md:113`).

## Related Research

- None earlier for spaced repetition.

## Open Questions

1. **Method:** FSRS via ts-fsrs 5.4.2 (recommended), v6/FSRS-7, or SM-2. — user decision (roadmap unknown).
2. **Rating mapping:** "Łatwe" → Good (recommended) or Easy. — user decision.
3. **Storage:** progress columns on `flashcards`, or a separate 1:1 table. Also: keep a review log (for undo, stats and future optimization) or not. — plan decision.
4. **Selection:**
   - new cards in general mode, and any new-card cap;
   - tag mode: due-first then all, and whether mastered cards are included;
   - whether review-ahead fills a short general session.
     — user decision.
5. **Session limit:** set per session or stored in the profile; default value. — user decision.
6. **Same-session re-show** after "Nie pamiętam" (short-term steps vs day-level only). — plan/user decision.
7. **Time boundary:** UTC `due <= now()` vs Europe/Warsaw "due today". — plan decision.
8. **Unverified:** the CPU time of `ts-fsrs` `next()` in workerd. A benchmark was blocked in this session; verify with a unit test or a dev smoke run during implementation.
