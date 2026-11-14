# AI Content-Quality Rate Implementation Plan

## Overview

Roadmap slice S-07 (FR-013; the PRD's primary success criterion). A new "Statystyki" page shows the AI content-quality rate:

> (accepted unchanged + accepted after correction) ÷ (all accepted + rejected as "Błędne")

The page shows this rate for lesson generation overall, per AI model, and separately for the manual "Dodaj słowo" fill. Each is shown from the start and for the last 30 days, next to the 75% target. Rejections as "Znam / nieprzydatne" and "Za łatwe" are excluded from the rate and shown as separate word-selection counts.

## Current State Analysis

- Every reviewed AI proposal leaves one row in `proposal_outcomes` (`supabase/migrations/20261110224353_proposal_outcomes.sql:10-27`):
  - `outcome` ∈ `accepted_unchanged | accepted_corrected | rejected_wrong | rejected_known | rejected_too_easy`;
  - `model`, which is nullable;
  - `merged` (the word was already in the collection, so only the lesson tag was added);
  - `created_at`;
  - `source` ∈ `lesson | manual`, added by `20261111184853_manual_outcomes.sql:12`.

  RLS: select and insert own rows only. The table is append-only.

- Accepted outcomes are classified by comparing the AI original with the final reviewed item (`src/lib/ai/outcomes.ts:78`). That covers merged items too, so a merged accept still reflects the user's verdict on the AI content.
- Pattern for a protected server-rendered page: `src/pages/collection.astro` (load on the server with a client from `createClient`, log failures, error box), `PROTECTED_ROUTES` in `src/middleware.ts:4`, and Dashboard links in `src/pages/dashboard.astro:17-30`.
- RPC pattern: `security invoker set search_path = ''`, `revoke … from public, anon; grant … to authenticated` (`supabase/migrations/20261111214624_flashcard_tag_edit.sql`). Production migrations are applied by the user before the code push (`context/deployment/deploy-plan.md:58-61`).

## Desired End State

A "Statystyki" link on the Dashboard opens `/stats`. The page shows a table:

| Row                                          | Od początku           | Ostatnie 30 dni |
| -------------------------------------------- | --------------------- | --------------- |
| Lekcje — łącznie                             | rate % (n ocenionych) | rate % (n)      |
| one row per model used for lesson generation | …                     | …               |
| Dodaj słowo                                  | …                     | …               |

- A "Cel: 75%" marker sits next to the overall lesson rate.
- Below the table:
  - the share of accepted proposals taken without correction (overall, lesson, both periods);
  - the word-selection counts ("Znam / nieprzydatne: N", "Za łatwe: N", lesson, both periods).
- A row with no rated proposals shows "—" instead of a percentage.
- With no outcomes at all, the page shows "Brak danych — wygeneruj i przejrzyj pierwszą lekcję." with a link to `/generate`.

### Key Discoveries:

- Merged accepts count as accepted (user decision). They are classified like any other accept.
- `model` can be null for rows written before the model was recorded or for unusual paths. Such rows go to a "nieznany model" row.
- No data is written by this change: it is read-only over existing rows.

## What We're NOT Doing

- No learning statistics (FR-012: total, mastered and difficult cards).
- No charts or time series beyond the two periods.
- No word-selection _rate_ (the PRD does not require displaying it in the MVP); counts only.
- No per-tag or per-lesson breakdown, no export, no stats for other users.
- No changes to how outcomes are recorded.
- No Polish plural forms beyond fixed wording.

## Implementation Approach

Aggregate in Postgres with one read-only RPC that returns counts grouped by source, model, outcome and period. This sends only a few dozen rows to the Worker, keeping CPU flat as data grows. A pure TypeScript module turns the counts into rates, so the definition of the metric lives in one tested place. The page renders on the server, with no client island.

## Phase 1: Data and calculation

### Overview

The server can fetch aggregated outcome counts for the signed-in user and turn them into the quality figures. No UI yet.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_outcome_stats.sql` (new)

**Intent**: A read-only aggregation over the caller's own outcomes.

**Contract**:

- `proposal_outcome_stats()` returns `table(source text, model text, outcome text, recent boolean, n bigint)`.
  - It is `language sql stable security invoker set search_path = ''`.
  - It groups the caller's `proposal_outcomes` by `source`, `model`, `outcome` and `recent`, where `recent` is `created_at >= now() - interval '30 days'`.
  - RLS limits rows to the caller.
- Grants: `revoke execute … from public, anon; grant execute … to authenticated`.
- Additive: nothing existing changes.

#### 2. Generated types

**File**: `src/db/database.types.ts`

**Intent**: Regenerate with `npm run db:types` so the RPC is typed.

**Contract**: No hand edits.

#### 3. Quality calculation

**File**: `src/lib/ai/quality-stats.ts` (new), `src/lib/ai/quality-stats.test.ts` (new)

**Intent**: The single definition of the metric (PRD Success Criteria), pure and tested.

**Contract**:

- `type OutcomeCount = { source: "lesson" | "manual"; model: string | null; outcome: Outcome; recent: boolean; n: number }`.
- `qualityRate(counts) → { rate: number | null; rated: number; unchangedShare: number | null; accepted: number }`.
  - `rated` = unchanged + corrected + wrong.
  - `rate` = (unchanged + corrected) ÷ `rated`.
  - `unchangedShare` = unchanged ÷ (unchanged + corrected).
  - Both are `null` when the denominator is 0.
  - Known and too-easy outcomes are ignored.
- `buildQualityStats(counts) → QualityStats`. The result has:
  - `lesson: { all, recent }` (overall lesson figures);
  - `lessonByModel: { model: string | null; all; recent }[]`, sorted by `all.rated` descending, then by model name;
  - `manual: { all, recent }`;
  - `wordSelection: { all: { known, tooEasy }, recent: { known, tooEasy } }` (lesson only);
  - `hasData: boolean`.

  The 30-day figures use the rows with `recent = true`; the "all" figures sum both.

- Tests:
  - the PRD formula on a mixed set;
  - known/too-easy excluded from the rate but counted in `wordSelection`;
  - `null` with zero rated;
  - recent vs all split;
  - per-model grouping including a null model;
  - manual kept apart from lesson;
  - merged accepts counted (they arrive as `accepted_*`).

#### 4. Service

**File**: `src/lib/services/stats.service.ts` (new), `src/lib/services/stats.service.test.ts` (new)

**Intent**: Fetch the counts and return `QualityStats`, mirroring `flashcards.service.ts` conventions.

**Contract**:

- `getQualityStats(client) → Promise<QualityStats>` calls the `proposal_outcome_stats` RPC, maps the rows (bigint/string `n` → number), validates `source`/`outcome` values (unknown values are skipped), and applies `buildQualityStats`.
- Store errors use the existing `FlashcardStoreError`/`storeError` pattern, with the SQLSTATE only.
- Tests use the stub client: the RPC name, row mapping including string counts, unknown values skipped, and the error mapping.

#### 5. Checks and docs

**File**: `scripts/check-rls.mjs`, `docs/reference/contract-surfaces.md`

**Intent**: Prove that the RPC returns only the caller's outcomes and that anon is rejected, and record the new contract.

**Contract**:

- An S-07 section:
  - A's `proposal_outcome_stats` totals equal A's own `proposal_outcomes` row count;
  - B's result contains none of A's rows (B's totals equal B's own count);
  - anon gets an error.
- `contract-surfaces.md`: the migration, the RPC row and the `getQualityStats` service row.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Types regenerated with no diff after commit: `npm run db:types`
- RLS checks pass, including the new S-07 section: `npm run check:rls`
- Unit tests pass: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`

#### Manual Verification:

- In Supabase Studio's SQL editor, as a test user's session (or by inspecting the `check:rls` S-07 step output), the RPC's grouped counts match a manual count of that user's outcomes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Stats page and production

### Overview

The learner opens "Statystyki" and sees the quality rate; the migration and code reach production.

### Changes Required:

#### 1. Page

**File**: `src/pages/stats.astro` (new), `src/middleware.ts`, `src/pages/dashboard.astro`

**Intent**: A protected, server-rendered page in the style of `collection.astro`.

**Contract**:

- The page loads `getQualityStats` on the server. On failure it logs `stats_page_failed` (no content) and shows an error box with a reload link.
- It renders the table from the Desired End State:
  - percentages rounded to whole numbers;
  - `n` shown as "(N ocenionych)";
  - "—" when `rate` is null;
  - the model row label is the model id, or "nieznany model".
- "Cel: 75%" sits next to the overall lesson rate. When the rate is not null, it is marked "osiągnięty" or "poniżej celu" with color plus text (never color alone).
- Below the table come the unchanged share and the word-selection counts, then the empty state described above.
- `"/stats"` is added to `PROTECTED_ROUTES`, and the Dashboard gets a "Statystyki" link.

#### 2. Docs

**File**: `README.md`, `AGENTS.md`

**Intent**: Document the page and where the metric is defined.

**Contract**:

- README: a `/stats` row in the route table and the RPC in the schema paragraph.
- AGENTS.md: in the scope paragraph, the stats page, the rule that the metric is defined only in `src/lib/ai/quality-stats.ts`, and that the aggregation is the `proposal_outcome_stats` RPC.

#### 3. Rollout

**Intent**: Schema first, then code.

**Contract**: The user runs `npx supabase db push` against production and confirms the migration is listed as applied remotely; then the commits are pushed.

### Success Criteria:

#### Automated Verification:

- Unit tests, lint and type check pass: `npm test`, `npm run lint`, `npx astro check`
- Build passes: `npm run build && npm run check:client-only`
- CI passes on `master` after push

#### Manual Verification:

- Dev: `/stats` shows the table with plausible numbers for the local test account, and an empty account shows the empty state.
- The production migration is applied (`npx supabase migration list` shows it Local and Remote) before the code push.
- Production: `/stats` loads on a phone and the overall lesson rate matches expectations from recent reviews.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `quality-stats.ts`:
  - PRD formula;
  - exclusions;
  - null on zero;
  - recent/all;
  - per model incl. null;
  - manual separate;
  - merged counted;
  - sorting.
- `stats.service.ts`: RPC call, mapping (string counts), unknown values skipped, errors.

### Integration Tests:

- `check:rls` S-07: A's totals match A's rows, B sees none of A's rows, anon is rejected.

### Manual Testing Steps:

1. Dev: open `/stats` with the test account; numbers match recent reviews.
2. Dev: a fresh account shows the empty state.
3. Production: the migration is applied first; `/stats` loads on a phone with plausible numbers.

## Performance Considerations

One RPC per page load that scans the user's outcomes (hundreds to low thousands of rows) and returns at most a few dozen grouped rows. That is negligible database work and negligible Worker CPU.

## Migration Notes

Additive: one read-only function. The user applies it in production before the code push. If the code arrives first, `/stats` shows its error box; other pages are unaffected.

## References

- PRD Success Criteria and FR-013 (`context/foundation/prd.md`)
- `supabase/migrations/20261110224353_proposal_outcomes.sql`, `20261111184853_manual_outcomes.sql`
- `src/lib/ai/outcomes.ts:78` (accept classification)
- `src/pages/collection.astro`, `src/middleware.ts:4`, `src/pages/dashboard.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data and calculation

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 361387f
- [x] 1.2 Types regenerated with no diff after commit: `npm run db:types` — 361387f
- [x] 1.3 RLS checks pass, including the new S-07 section: `npm run check:rls` — 361387f
- [x] 1.4 Unit tests pass: `npm test` — 361387f
- [x] 1.5 Lint and type check pass: `npm run lint` and `npx astro check` — 361387f

#### Manual

- [x] 1.6 RPC grouped counts match a manual count of the test user's outcomes — 361387f

### Phase 2: Stats page and production

#### Automated

- [x] 2.1 Unit tests, lint and type check pass: `npm test`, `npm run lint`, `npx astro check` — f6bb512
- [x] 2.2 Build passes: `npm run build && npm run check:client-only` — f6bb512
- [x] 2.3 CI passes on `master` after push — f6bb512

#### Manual

- [x] 2.4 Dev: `/stats` shows plausible numbers; an empty account shows the empty state — f6bb512
- [x] 2.5 Production migration applied before the code push — f6bb512
- [x] 2.6 Production: `/stats` loads on a phone with plausible numbers — f6bb512
