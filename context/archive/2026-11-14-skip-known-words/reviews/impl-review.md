<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Skip Known Words

- **Plan**: context/changes/skip-known-words/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Evidence:

- **Plan adherence**: every changed file is in the plan. `src/lib/ai/word-key.ts` is the documented adaptation, in which `toKey` was moved to a pure module and re-exported. Every planned change matches its intent, and the "NOT doing" list holds: no prompt, word-fill, draft-format or migration changes.
- **Automated checks, re-run 2026-11-14**:
  - `npm test`: 307/307;
  - lint;
  - `npx astro check`: 0 errors;
  - `npm run check:rls`: all pass, including S-09;
  - build and `check:client-only` pass;
  - CI green on `3778c85`.
- **Manual checks**: the user confirmed 1.5, 2.4 and 2.5. For 1.5, the local DB showed `exhausting` (`rejected_known`) skipped, `give up` (`rejected_wrong`) back, and `gloomy` (accepted) marked in the collection.

## Findings

### F1 — JS and database key folding differ for non-ASCII whitespace

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/ai/word-key.ts:3 vs supabase/migrations/20261110224353_proposal_outcomes.sql:16
- **Detail**: JS `\s`/`trim()` fold NBSP (U+00A0) and similar characters. Postgres `'\s'` and `btrim()` usually do not. A word containing an NBSP would get different keys in JS and in the database, so it would never match and would be proposed again. The failure is safe: a missed skip, never a wrong one. The same mismatch already affects `findExistingWordKeys`.
- **Fix**: Accept as a risk; optionally soften the "same folding as the database" comment.
- **Decision**: ACCEPTED — fails safe (a missed skip); same as findExistingWordKeys

### F2 — `in(word_key, …)` list goes into the request URL

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/flashcards.service.ts:177-185
- **Detail**: In theory, up to 150 keys of up to 100 characters could make the PostgREST GET URL very long. Real lists are a few KB. An oversized request falls into the catch, and proposals come back unfiltered. This is the same pattern as `findExistingWordKeys`.
- **Fix**: Accept as a risk; if it ever matters, move both lookups to a POST-body RPC together.
- **Decision**: ACCEPTED — real lists are a few KB; an error falls back to unfiltered proposals

### F3 — Known-words and in-collection lookups run sequentially

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/ai/proposals.ts:144-145
- **Detail**: Each generation now makes two Supabase round trips one after the other. They could run in parallel on the unfiltered list. The latency is small next to the AI call.
- **Fix**: Skip; parallelize only if generation latency becomes noticeable.
- **Decision**: SKIPPED — latency is negligible next to the AI call
