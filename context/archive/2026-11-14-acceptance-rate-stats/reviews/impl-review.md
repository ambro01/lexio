<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: AI Content-Quality Rate

- **Plan**: context/changes/acceptance-rate-stats/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Success criteria run during review: `npm run db:types` (no diff), `npm run check:rls` (all pass, incl. the three S-07 steps), `npm test` (323/323), `npm run lint`, `npx astro check` (0/0/0). Build, client-only check and CI were green at f6bb512. `npx supabase db reset` was not re-run here (it would wipe the local test account); the migration applied in Phase 1 and is listed Local + Remote. All manual rows are confirmed by the user.

## Findings

### F1 — Space before the period in the empty state

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/stats.astro:89-92
- **Detail**: The `.` sits on its own line after `</a>`, so Astro renders "…pierwszą lekcję ." instead of the planned "…pierwszą lekcję.".
- **Fix**: Put the `.` directly after `</a>`.
- **Decision**: FIXED — the period now follows the link directly (`</a>{"."}`, prettier-stable); compiled markup verified.

### F2 — "75%" shown next to "poniżej celu"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/stats.astro:27, 123
- **Detail**: Percentages are rounded to whole numbers, but the target check uses the exact rate. A rate of 0.746 reads "75% · Cel: 75% ✗ poniżej celu", which looks contradictory.
- **Fix**: Show the overall lesson rate with one decimal (e.g. "74,6%") so the label and the verdict agree; other cells stay whole numbers.
- **Decision**: FIXED — the overall lesson row shows one decimal (pl-PL) and the target verdict is judged on that shown value.

### F3 — RPC relies on RLS alone for the user filter

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261114145441_outcome_stats.sql:23
- **Detail**: The function has no `where` clause; `security invoker` plus the select-own policy limits rows correctly for `authenticated` (proven by check:rls S-07). A service_role caller bypasses RLS and would silently get counts across all users. No such caller exists today.
- **Fix**: New migration that re-creates the function with `where po.user_id = (select auth.uid())`.
  - Strength: Fails closed for service_role and makes the index use explicit (Supabase RLS performance guidance).
  - Tradeoff: A second migration and another production `db push` before any code depending on it; no user-visible gain today.
  - Confidence: MED — the risk only materialises if an admin path ever calls the RPC.
  - Blind spot: Whether other RPCs in this repo follow the RLS-only style (the pattern may be intentionally consistent).
- **Decision**: FIXED — new migration `20261114223000_outcome_stats_user_filter.sql` adds `where po.user_id = (select auth.uid())`; check:rls S-07 passes. Needs a production `db push`.

### F4 — The 75% target lives in the page

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/stats.astro:9
- **Detail**: `TARGET_RATE = 0.75` (PRD target) is defined in `stats.astro`, while AGENTS.md says the metric is defined only in `src/lib/ai/quality-stats.ts`. The target is not part of the formula, so this is defensible.
- **Fix**: Export `QUALITY_TARGET` from `quality-stats.ts` and import it in the page.
- **Decision**: FIXED — `QUALITY_TARGET` exported from `quality-stats.ts` and imported by the page.

## Triage summary

- Fixed: F1, F2, F3, F4 (4)
