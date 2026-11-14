# Spaced-Repetition Review Session Implementation Plan

## Overview

Roadmap slice S-06 (FR-010, FR-011). The learner can start a review **by tag** or a **general** review with a card limit. They rate each card "Nie pamiętam", "Trudne" or "Łatwe", and can mark a card "Opanowane".

Scheduling uses the existing FSRS algorithm (`ts-fsrs` 5.4.2) on the server. Learning progress lives in two new tables, separate from flashcard content. A new `/review` page runs the session on desktop and mobile. "Opanowane" can also be toggled from the Collection.

## Current State Analysis

- No learning-progress data exists. All 7 migrations and `src/db/database.types.ts` were checked for due dates, intervals, stability, reps, a mastered flag and a review log, and none have them. F-02 deferred scheduling state and "Opanowane" to S-06 (`context/archive/2026-11-10-flashcard-data-contract/plan.md:41`).
- One review-ready piece exists: the index on `flashcard_tags(tag_id)` for review-by-tag (`supabase/migrations/20261110210825_flashcard_data_contract.sql:51-52`).
- Edits cannot touch progress. `updateFlashcard` copies only content fields (`src/lib/services/flashcards.service.ts:195-200`). The `flashcards_set_updated_at` trigger bumps `updated_at` on every update of `flashcards`, so progress kept there would rewrite "last edited". A separate table avoids that.
- Patterns to reuse:
  - Additive migrations with per-operation RLS, composite foreign keys on `(id, user_id)` with cascade (`…flashcard_data_contract.sql:39-129`).
  - RPCs written as `plpgsql security invoker set search_path = ''` that raise SQLSTATE errors (`20261111214624_flashcard_tag_edit.sql:15-83`).
  - Authenticated JSON routes (`src/pages/api/flashcards/[id].ts:26-89`).
  - A server-loaded Astro page with a React island (`src/pages/collection.astro`, `src/components/collection/shared.tsx`).
  - `scripts/check-rls.mjs`, with its `TABLES` array and per-slice `step(...)` sections.
- Name collision to avoid: `src/lib/review-draft.ts` and `useReviewDraft` belong to the AI **proposal** review (storage key `lexio:review-draft:${userId}`). Spaced-review code must use distinct names and keys.
- Research: `context/changes/spaced-review-session/research.md`. It covers the method comparison, the ts-fsrs API and defaults, and Anki's selection behaviour.

## Desired End State

The Dashboard links to **Powtórka** at `/review`.

The start screen offers two modes:

- **Ogólna**: the whole collection, excluding cards marked "Opanowane".
- **Według tagu**: pick one of the user's tags.

It also has a card limit, 1–100, default 20, remembered in the browser.

During a session:

- Each card shows the English word. "Pokaż" reveals the Polish translation, the additional meanings and the example sentence.
- Three rating buttons and an "Opanowane" button follow.
- A card rated "Nie pamiętam" comes back at the end of the session until it gets another rating.
- Every rating is saved immediately and reschedules the card with FSRS.
- The session ends with a summary.

In the Collection, each card shows an "Opanowane" badge and a toggle to set or clear it. Editing a card never changes its progress.

Verify with:

- unit tests for the scheduler and the service;
- `check:rls` with the new S-06 section;
- a manual session on desktop and on a phone against production.

### Key Discoveries:

- `ts-fsrs` 5.4.2 is MIT-licensed with zero dependencies. A static scan of its `dist` found no Node APIs. Its defaults are `request_retention` 0.9, `enable_fuzz` false and `enable_short_term` true (`node_modules/ts-fsrs/dist/index.mjs:503-511` of the scratch install; research §1).
- Its API: `fsrs(generatorParameters({...}))`, `createEmptyCard(now)`, `f.next(card, now, Rating.X)` → `{ card, log }`. Card fields: `due`, `stability`, `difficulty`, `elapsed_days` (deprecated), `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review`.
- PostgREST cannot embed `tags` directly from `flashcards` because of the composite foreign keys; it goes through `flashcard_tags` (`flashcards.service.ts:45-49`). The new `review_states` table relates to `flashcards` the same way (composite FK), so the Collection select embeds it as `review_states(mastered_at)`.
- Production migrations are applied by the user with `npx supabase db push` before code is pushed (`context/deployment/deploy-plan.md:58-61`).

## What We're NOT Doing

- No FSRS parameter optimization (defaults only), no ts-fsrs v6/FSRS-7, no SM-2.
- No fourth rating button ("Łatwe" maps to Good; nothing maps to Easy).
- No review-ahead filling in general mode. A general session with nothing due and nothing new is empty and says so.
- No separate daily new-card limit.
- No session limit in the profile and no profile changes. The limit is a field on the start screen, remembered in localStorage.
- No undo of a rating, no statistics screen (FR-012 is out of MVP), and no use of the review log beyond writing it.
- No resuming an interrupted session after a reload. Ratings already given are saved; a new session simply recomputes the queue.
- No "due today" by local day. Due means `due <= now()` in UTC.
- No Polish→English direction, typing answers or audio.
- No changes to the proposal review (`review-draft.ts`), generation, or the flashcard edit path.

## Implementation Approach

Work bottom-up:

1. Schema, scheduler and service, proven by unit tests and `check:rls`.
2. Thin API routes in the existing shape.
3. One React island for the start screen and the session, plus a small Collection change.
4. Docs and a production rollout, with the migration pushed before the code.

Selection runs in SQL as one RPC, so ordering and limits run in a single query rather than in Worker CPU. Scheduling runs in TypeScript on the server, the only place ts-fsrs runs. A second RPC writes the new state and the log row atomically, with an optimistic check against double submission.

## Critical Implementation Details

- **State sequencing (double submit):** `record_review` takes the `reps` value the server read before computing (`p_expected_reps`, null when no state row exists). If the stored value differs, it raises SQLSTATE `40001`, and the route returns 409. A double tap or a second tab therefore cannot apply two ratings computed from the same state.
- **New cards:** a card is new when it has no `review_states` row, or its row has `state = 0`. A row with `state = 0` exists when a never-reviewed card was marked "Opanowane". The scheduler builds the starting card with `createEmptyCard(now)` when no row exists.
- **Fuzz and tests:** production uses `enable_fuzz: true`. Unit tests that assert exact intervals use a scheduler built with fuzz off, or they assert ranges. The rating mapping and the state round-trip are asserted exactly.
- **Timing & lifecycle (same-session re-show):** after "Nie pamiętam", the client appends the card to the end of its in-memory queue. The rating is still saved immediately. When the card comes back, it is rated again against its fresh server state. FSRS short-term steps handle the minutes-scale gap.

## Phase 1: Review data and scheduler

### Overview

The database stores per-card review state and a review log under RLS. The server can compute a rating with FSRS and persist it atomically, and it can build a review queue. No UI or routes yet.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_review_session.sql` (new)

**Intent**: Add the two progress tables and three RPCs, following the F-02/S-05 conventions.

**Contract**:

- **`review_states`**
  - Columns:
    - `flashcard_id uuid primary key`
    - `user_id uuid not null default auth.uid()`
    - `due timestamptz not null`
    - `stability double precision not null`
    - `difficulty double precision not null`
    - `scheduled_days integer not null`
    - `learning_steps integer not null`
    - `reps integer not null`
    - `lapses integer not null`
    - `state smallint not null check (state between 0 and 3)`
    - `last_review timestamptz null`
    - `mastered_at timestamptz null`
    - `updated_at timestamptz not null default now()`
  - Composite FK `(flashcard_id, user_id)` → `flashcards (id, user_id) on delete cascade`.
  - Index on `(user_id, due)`.
  - RLS: select, insert and update for `authenticated` with `user_id = (select auth.uid())`. No delete policy; rows go away only by cascade.
- **`review_log`**
  - Columns:
    - `id bigint generated always as identity primary key`
    - `user_id uuid not null default auth.uid()`
    - `flashcard_id uuid not null`
    - `rating smallint not null check (rating between 1 and 3)`
    - `state smallint not null`
    - `due timestamptz not null`
    - `stability double precision not null`
    - `difficulty double precision not null`
    - `scheduled_days integer not null`
    - `reviewed_at timestamptz not null default now()`
  - Composite FK to `flashcards` with cascade.
  - RLS: select and insert only.
- **`review_queue(p_tag_id uuid default null, p_limit integer)`**
  - `returns table(...)` with the card content columns plus `due`, `state` and `mastered`.
  - Implemented as `language sql stable security invoker set search_path = ''`.
  - Raises `22023` when `p_limit` is not between 1 and 100.
  - Ordering:
    - **General** (`p_tag_id` null): non-mastered cards with `due <= now()`, ordered by `due` ascending. Then new cards, ordered by `flashcards.created_at` ascending, then `id`. At most `p_limit` rows.
    - **Tag**: the tag's cards, mastered included. Due cards first (by `due`), then new cards (by `created_at`, then `id`), then the rest (by `due`). At most `p_limit` rows.
  - Rationale: the general-mode ordering follows the user's decision; the tag-mode ordering is the "all of the tag, weaker first" decision.
- **`record_review(p_flashcard_id uuid, p_expected_reps integer, p_rating smallint, p_state jsonb)`**
  - `plpgsql security invoker`.
  - Raises `P0002` when the card is not the caller's.
  - Raises `40001` when the stored `reps` (null when no row) differs from `p_expected_reps`.
  - Otherwise upserts `review_states` from `p_state` and inserts one `review_log` row in the same transaction, keeping `mastered_at` untouched.
  - Raises `22023` for an invalid rating or state.
- **`set_flashcard_mastered(p_flashcard_id uuid, p_mastered boolean, p_empty_state jsonb)`**
  - Raises `P0002` for a foreign or missing card.
  - Sets `mastered_at = now()` or `null` on the state row. When no row exists, it inserts one from `p_empty_state` (the server's `createEmptyCard`).
- Grants: `revoke execute ... from public, anon; grant execute ... to authenticated`, as in the existing RPCs.

#### 2. Generated types

**File**: `src/db/database.types.ts`

**Intent**: Regenerate with `npm run db:types` so the tables and RPCs are typed.

**Contract**: No hand edits.

#### 3. Scheduler

**File**: `src/lib/review/scheduler.ts` (new), `src/lib/review/scheduler.test.ts` (new), `package.json`

**Intent**: Keep the single place that knows FSRS: the rating mapping, row ↔ card conversion and computing the next state. Keep it pure so Vitest tests it with fixed dates.

**Contract**:

- Dependency `ts-fsrs` pinned to `5.4.2` (exact).
- `REVIEW_RATINGS = ["again", "hard", "good"] as const`, the API values for "Nie pamiętam", "Trudne" and "Łatwe".
- Mapping to `Rating.Again`, `Rating.Hard` and `Rating.Good`. The DB stores 1, 2 and 3.
- `scheduleReview(state: ReviewState | null, rating, now: Date): ReviewState`. It uses a module-level `fsrs(generatorParameters({ enable_fuzz: true }))` and starts from `createEmptyCard(now)` when `state` is null.
- `emptyReviewState(now)` returns the starting state used by "Opanowane".
- `ReviewState` is the camelCase mirror of the `review_states` FSRS columns, with `Date` values.
- Tests:
  - the mapping;
  - null state → a learning card after "again", due within minutes;
  - "good" on a review card pushes `due` beyond "hard";
  - a round-trip through the row shape preserves the values;
  - a timing test: 1,000 `scheduleReview` calls finish well under 1,000 ms locally. This guards the 10 ms Worker CPU assumption, which research could not measure.

#### 4. Review service

**File**: `src/lib/services/review.service.ts` (new), `src/lib/services/review.service.test.ts` (new)

**Intent**: The only module that reads and writes review data, mirroring `flashcards.service.ts`: typed client, mapped rows and SQLSTATE-only error messages.

**Contract**:

- `loadReviewQueue(client, { tagId?: string, limit }): Promise<ReviewCard[]>` calls `review_queue`.
- `rateCard(client, flashcardId, rating, now): Promise<ReviewState>`. It reads the state row (or null), calls `scheduleReview`, then calls `record_review` with the read `reps`.
- `setMastered(client, flashcardId, mastered, now): Promise<void>`.
- Errors:
  - `ReviewConflictError` for `40001`;
  - `FlashcardNotFoundError`, reused from `flashcards.service.ts`, for `P0002`;
  - `FlashcardStoreError` for anything else.
- `ReviewCard` (in `src/types.ts`) has `id`, `word`, `translation`, `additionalMeanings`, `exampleSentence`, `cefr`, `isNew`, `mastered` and `due` (ISO or null).
- Tests use the stub-client pattern from `flashcards.service.test.ts`: the RPC names and arguments sent, mapping, the error mapping for `40001` and `P0002`, and the null-state path.

#### 5. RLS and behaviour checks

**File**: `scripts/check-rls.mjs`

**Intent**: Prove isolation and the selection and concurrency rules against local Supabase.

**Contract**:

- Add `review_states` and `review_log` to `TABLES`.
- Add an S-06 section of `step(...)` checks:
  - B cannot read, rate or master A's card (`P0002`, no rows written);
  - anon cannot call the RPCs;
  - `record_review` with a stale `p_expected_reps` raises `40001` and writes nothing;
  - general queue order: an overdue card before a new card, a mastered card absent, limit respected;
  - tag queue: mastered card present, a not-yet-due card after a new card;
  - deleting a card cascades its state and log rows;
  - editing a card leaves its `review_states` row unchanged.
- The test writes states through `record_review` with hand-made JSON, because the scheduler is TypeScript and the script is plain Node.

#### 6. Contract surfaces

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Record the new tables, RPCs and service.

**Contract**:

- Add the migration to the list.
- Add rows for `review_states`, `review_log`, `review_queue`, `record_review`, `set_flashcard_mastered` and `review.service`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Types regenerated with no diff after commit: `npm run db:types`
- RLS and review checks pass, including the new S-06 section: `npm run check:rls`
- Unit tests pass, including the scheduler timing test: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes and pdf.js stays out of the Worker bundle: `npm run build && npm run check:client-only`

#### Manual Verification:

- In Supabase Studio, after running `check:rls`, the `review_states` and `review_log` rows of the test users look sane: due dates in the future after "good", a short due after "again", and one log row per rating.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Review API

### Overview

Authenticated endpoints let the browser load a session, rate a card and toggle "Opanowane". The Collection list carries the mastered flag.

### Changes Required:

#### 1. Request schemas

**File**: `src/lib/review/requests.ts` (new) and test

**Intent**: Zod schemas shared by the routes and the island, pure and with no `astro:*` imports.

**Contract**:

- `sessionRequestSchema`: `{ tagId?: uuid, limit: int 1..100 }`.
- `rateRequestSchema`: `{ flashcardId: uuid, rating: "again" | "hard" | "good" }`.
- `masteredRequestSchema`: `{ mastered: boolean }`.
- `REVIEW_LIMIT_DEFAULT = 20` and `REVIEW_LIMIT_MAX = 100`.

#### 2. Routes

**File**: `src/pages/api/review/session.ts`, `src/pages/api/review/rate.ts`, `src/pages/api/flashcards/[id]/mastered.ts` (new)

**Intent**: Thin routes in the shape of `src/pages/api/flashcards/[id].ts`.

**Contract**:

- Guards: 401, 415, a small `Content-Length` cap (4 KB), zod → 400 `bad_request`, 503 `not_configured` when there is no client. For `[id]`, `isUuid` → 404 before any query.
- `POST /api/review/session` → 200 `{ cards: ReviewCard[] }`. An unknown or foreign `tagId` yields an empty list, not an error.
- `POST /api/review/rate` → 200 `{ due, state }`. Errors:
  - 404 `not_found` when the card is gone;
  - 409 `conflict` with "Ta karta została już oceniona. Odśwież sesję.";
  - 500 `store_failed`.
- `PUT /api/flashcards/[id]/mastered` → 200 `{ mastered }`. Errors: 404 and 500 as above.
- One log line per call, with no words or IDs:
  - `event: "review_session"` with status, mode, limit and the returned count;
  - `"review_rate"` with status and rating;
  - `"review_mastered"` with status and the mastered value.

#### 3. Mastered flag in the Collection data

**File**: `src/lib/services/flashcards.service.ts`, `src/types.ts`, `src/components/collection/shared.tsx` (type guard), the related tests

**Intent**: The Collection must show and toggle "Opanowane" without an extra request.

**Contract**:

- `FLASHCARD_SELECT` embeds `review_states(mastered_at)`.
- `Flashcard` gains `mastered: boolean`. A card with no row, or with a null `mastered_at`, is not mastered.
- `isFlashcard*` guards accept the new field.
- `updateFlashcard`'s whitelist is unchanged.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build && npm run check:client-only`
- RLS checks still pass: `npm run check:rls`

#### Manual Verification:

- In dev, signed in, from the browser console:
  - `POST /api/review/session {limit: 5}` returns up to 5 cards, new ones included;
  - `POST /api/review/rate` with "good" returns a future `due`;
  - repeating the same rate request immediately returns 200, because it is a new rating against the fresh state, not a 409;
  - `PUT /api/flashcards/<id>/mastered {mastered: true}` makes that card disappear from a general session.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Review screen and Collection toggle

### Overview

The learner runs review sessions on `/review` and toggles "Opanowane" in the Collection.

### Changes Required:

#### 1. Page and route protection

**File**: `src/pages/review.astro` (new), `src/middleware.ts`, `src/pages/dashboard.astro`

**Intent**: A protected page following `collection.astro`.

**Contract**:

- The page loads the user's tags on the server with `listTags`. On failure it logs `review_page_failed` and falls back to no tag options.
- It mounts the island with `client:load`.
- `"/review"` is added to `PROTECTED_ROUTES`.
- The Dashboard gets a "Powtórka" link next to the existing ones.

#### 2. Session island

**File**: `src/components/review/ReviewSession.tsx`, `src/lib/review/session.ts` (new) and test

**Intent**: The start screen, the session and the summary in one island. The queue logic is pure and unit-tested.

**Contract**:

- `session.ts` (pure) holds the session queue state: current card, revealed flag, counts.
  - "again" appends the card to the end of the queue.
  - "hard" or "good" removes it.
  - "Opanowane" removes it without a rating.
  - A summary gives `{ reviewed, again, hard, good, mastered }`.
- Start screen:
  - mode toggle "Ogólna" / "Według tagu" (the tag select is enabled only when the user has tags);
  - limit field 1–100, defaulting to the localStorage value `lexio:review-limit` or 20;
  - a "Zacznij" button.
- Card:
  - the word large;
  - a "Pokaż" button;
  - after reveal: translation, additional meanings and the example sentence;
  - rating buttons "Nie pamiętam", "Trudne", "Łatwe", where "Trudne" carries the hint "pamiętam, z trudem";
  - a separate "Opanowane" action;
  - progress "Karta X / Y".

  Buttons are full width on mobile, and rating buttons are disabled while their request is in flight.

- Errors:
  - a failed rating shows a retryable error and keeps the card;
  - 409 shows the server message and a "Zacznij od nowa" action;
  - an empty queue shows "Brak kart do powtórki" with a hint (general: nothing due or new; tag: the tag has no cards).
- Names avoid "review draft": the component and file prefixes are `ReviewSession` and `session`, under `src/components/review/` and `src/lib/review/`.

#### 3. Collection toggle

**File**: `src/components/collection/CollectionCard.tsx`, `src/components/collection/CollectionBrowser.tsx`

**Intent**: Show and toggle "Opanowane" per card.

**Contract**:

- A badge "Opanowane" when `mastered`.
- A toggle action that calls `PUT /api/flashcards/[id]/mastered` and updates the card in memory.
- Errors use the existing `ErrorBox` pattern.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the session queue tests: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes and pdf.js stays out of the Worker bundle: `npm run build && npm run check:client-only`

#### Manual Verification:

- Dev, desktop: a general session of 5 cards; "Nie pamiętam" brings a card back at the end; the summary counts match.
- Dev: a tag session shows a mastered card of that tag; the general session does not.
- Dev: "Opanowane" toggled in the Collection is reflected in the next general session; editing a card's text does not change its due date (check `review_states` in Studio).
- Dev, mobile viewport (DevTools device mode): buttons are reachable with the thumb, and nothing overflows.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Docs and production rollout

### Overview

Docs reflect the review feature, the migration reaches production before the code, and a real session runs on a phone.

### Changes Required:

#### 1. Docs

**File**: `README.md`, `AGENTS.md`

**Intent**: Document the route and the rules for review data.

**Contract**:

- README: a `/review` row in the route table, and the review tables in the schema paragraph.
- AGENTS.md:
  - review data is read and written only through `review.service.ts` and its RPCs;
  - flashcard edits never touch `review_states`;
  - `ts-fsrs` is pinned to 5.4.2 and is the only scheduler.

#### 2. Rollout

**Intent**: Schema first, then code.

**Contract**:

- The user runs `npx supabase db push` against production and confirms the migration shows as applied remotely.
- Only then are the commits pushed to `master`.

### Success Criteria:

#### Automated Verification:

- Lint, tests and build pass: `npm run lint && npm test && npm run build`
- CI passes on `master` after push

#### Manual Verification:

- The production migration is applied (`npx supabase migration list` shows it Local and Remote) before the code is pushed.
- Phone, production: a general session over the real collection rates cards smoothly and comfortably, and a second session the same day shows only cards rated "Nie pamiętam" or "Trudne" that are due again, or none.
- Workers logs show `review_rate` lines with status 200 and no CPU-limit errors.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `scheduler.ts`: rating mapping, null-state start, Again vs Hard vs Good ordering of `due`, row round-trip, and the timing guard (1,000 calls).
- `review.service.ts`: RPC names and arguments, row mapping, `40001` → `ReviewConflictError`, `P0002` → `FlashcardNotFoundError`, and the null-state path.
- `requests.ts`: limit bounds, rating enum, UUIDs.
- `session.ts`:
  - "again" re-queues at the end;
  - "hard"/"good" remove;
  - "Opanowane" removes without a rating;
  - summary counts;
  - an empty queue.

### Integration Tests:

- `check:rls` S-06 section against local Supabase:
  - isolation;
  - anon blocked;
  - stale `reps` → `40001`;
  - general and tag queue order and limit;
  - mastered excluded or included;
  - cascade on delete;
  - edit does not touch progress.

### Manual Testing Steps:

1. Dev, desktop: general session with re-show and summary.
2. Dev: tag session including a mastered card.
3. Dev: Collection toggle reflected in a general session; edit keeps the due date.
4. Dev, mobile viewport: layout.
5. Production, phone: real session; second session the same day; Workers logs.

## Performance Considerations

- Queue selection is one SQL call with an index on `review_states(user_id, due)`, plus the existing `flashcard_tags(tag_id)` index. The collection is small (hundreds of cards).
- One `scheduleReview` call is a handful of floating-point operations (inference). The phase 1 timing test checks it. Each rating is one state read plus one RPC: I/O, not Worker CPU.

## Migration Notes

- Additive only: two new tables and three functions. Existing data is untouched, and no backfill is needed: cards without a state row are "new".
- The user applies the production migration before the code push. The new routes fail with 500 `store_failed` if the code arrives first, so order matters.

## References

- Research: `context/changes/spaced-review-session/research.md`
- PRD: FR-010, FR-011 (`context/foundation/prd.md:110-113`); edit rule (`prd.md:100`)
- Patterns: `supabase/migrations/20261111214624_flashcard_tag_edit.sql`, `src/lib/services/flashcards.service.ts`, `src/pages/api/flashcards/[id].ts`, `src/pages/collection.astro`, `scripts/check-rls.mjs`
- ts-fsrs 5.4.2: https://github.com/open-spaced-repetition/ts-fsrs/blob/v5.4.2/README.md
- Anki rating semantics: https://docs.ankiweb.net/studying.html, https://docs.ankiweb.net/deck-options.html

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Review data and scheduler

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 8d7c8ef
- [x] 1.2 Types regenerated with no diff after commit: `npm run db:types` — 8d7c8ef
- [x] 1.3 RLS and review checks pass, including the new S-06 section: `npm run check:rls` — 8d7c8ef
- [x] 1.4 Unit tests pass, including the scheduler timing test: `npm test` — 8d7c8ef
- [x] 1.5 Lint and type check pass: `npm run lint` and `npx astro check` — 8d7c8ef
- [x] 1.6 Build passes and pdf.js stays out of the Worker bundle: `npm run build && npm run check:client-only` — 8d7c8ef

#### Manual

- [x] 1.7 Studio: review_states and review_log rows of the check users look sane — 8d7c8ef

### Phase 2: Review API

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — a435ba7
- [x] 2.2 Lint and type check pass: `npm run lint` and `npx astro check` — a435ba7
- [x] 2.3 Build passes: `npm run build && npm run check:client-only` — a435ba7
- [x] 2.4 RLS checks still pass: `npm run check:rls` — a435ba7

#### Manual

- [x] 2.5 Dev console: session, rate, repeat rate and mastered endpoints behave as specified — a435ba7

### Phase 3: Review screen and Collection toggle

#### Automated

- [x] 3.1 Unit tests pass, including the session queue tests: `npm test`
- [x] 3.2 Lint and type check pass: `npm run lint` and `npx astro check`
- [x] 3.3 Build passes and pdf.js stays out of the Worker bundle: `npm run build && npm run check:client-only`

#### Manual

- [x] 3.4 Dev desktop: general session with re-show and matching summary
- [x] 3.5 Dev: tag session shows a mastered card; general session does not
- [x] 3.6 Dev: Collection toggle reflected in the next general session; edit keeps the due date
- [x] 3.7 Dev mobile viewport: buttons reachable, no overflow

### Phase 4: Docs and production rollout

#### Automated

- [ ] 4.1 Lint, tests and build pass: `npm run lint && npm test && npm run build`
- [ ] 4.2 CI passes on `master` after push

#### Manual

- [ ] 4.3 Production migration applied before the code push
- [ ] 4.4 Phone, production: real general session and a second same-day session behave as expected
- [ ] 4.5 Workers logs: review_rate lines with status 200 and no CPU-limit errors
