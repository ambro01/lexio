# AI Content-Quality Rate — Plan Brief

> Full plan: `context/changes/acceptance-rate-stats/plan.md`

## What & Why

Roadmap slice S-07 (FR-013). The PRD's primary success criterion is that AI content quality reaches at least 75%:

> (accepted unchanged + accepted after correction) ÷ (all accepted + rejected as "Błędne")

The learner needs to see this number to judge the AI and to compare the three configured models. Rejections as "Znam / nieprzydatne" and "Za łatwe" measure word selection, not content, so they stay out of the rate.

## Starting Point

S-01 records every reviewed proposal in `proposal_outcomes` with its outcome, model, source (lesson or manual "Dodaj słowo"), a merged flag and a timestamp. Nothing displays these records yet.

## Desired End State

A "Statystyki" link on the Dashboard opens `/stats`. It shows the rate for lesson generation overall, per model, and for "Dodaj słowo" separately, each from the start and for the last 30 days, with the 75% target marked. Below that come the share of proposals accepted without correction and the counts of "Znam" / "Za łatwe" rejections. A new account sees an empty state.

## Key Decisions Made

| Decision             | Choice                                                           | Why (1 sentence)                                                          | Source |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| Where                | A new `/stats` page with a Dashboard link                        | Room for the breakdown and future learning stats (FR-012)                 | Plan   |
| Per-model breakdown  | Overall plus one row per model                                   | Lets the learner compare the profile models (FR-016) on their own lessons | Plan   |
| Periods              | From the start and the last 30 days                              | Shows whether a model or prompt change improved quality                   | Plan   |
| Manual "Dodaj słowo" | A separate row, not mixed into the lesson rate                   | The PRD criterion concerns lessons; manual fill uses a different prompt   | Plan   |
| Merged accepts       | Counted like any accept                                          | The learner still judged the AI content; matches the PRD formula          | Plan   |
| Aggregation          | One read-only `security invoker` RPC grouping counts in Postgres | Only a few dozen rows reach the Worker, so CPU stays flat as data grows   | Plan   |
| Metric definition    | One pure module `quality-stats.ts`, unit-tested                  | A single source of truth for the success criterion                        | Plan   |

## Scope

**In scope:**

- A migration with the `proposal_outcome_stats` RPC.
- A pure calculation module and the stats service, with tests.
- An S-07 section in `check:rls` and contract docs.
- The `/stats` page, its route protection and the Dashboard link.
- README/AGENTS updates, the production migration and a phone check.

**Out of scope:**

- Learning statistics (FR-012), charts and time series, a word-selection rate, and per-lesson breakdowns or export.
- Changes to how outcomes are recorded.

## Architecture / Approach

```
/stats (Astro, server-rendered) → getQualityStats(client)
  → RPC proposal_outcome_stats() — counts by source, model, outcome, last-30-days flag (RLS: own rows)
  → buildQualityStats (pure) → table: lessons overall / per model / Dodaj słowo × all / 30 days
```

## Phases at a Glance

| Phase                        | What it delivers                                                           | Key risk                                        |
| ---------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| 1. Data and calculation      | RPC migration, types, pure metric module and service with tests, check-rls | Metric definition drifting from the PRD formula |
| 2. Stats page and production | `/stats` page, Dashboard link, docs, production migration, phone check     | Code reaching production before the migration   |

**Prerequisites:**

- S-01 (done).
- Local Supabase for `db reset` and `check:rls`.
- The user applies the production migration.

**Estimated effort:** about 1 session across 2 phases.

## Open Risks & Assumptions

- With few reviewed proposals, the per-model and 30-day rates are noisy. The page shows each rate's sample size ("N ocenionych").
- Outcome rows with no recorded model appear as "nieznany model".

## Success Criteria (Summary)

- The learner can read the AI content-quality rate and see whether it meets the 75% target.
- The rate is computed exactly by the PRD formula, with the word-selection rejections shown separately.
- Each user sees only their own statistics.
