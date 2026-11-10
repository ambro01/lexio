<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Flashcard Data Contract

- **Plan**: context/changes/flashcard-data-contract/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-10
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Success criteria re-run on 2026-11-10: `npx supabase db reset` OK, `npm run check:rls` all pass, `npm test` 35/35, `npx astro check` 0 errors. `npm run smoke` and `npm run build` were green at the phase commits (not re-run here). Production migration confirmed by the user (`migration list` Local + Remote, RLS visible in the dashboard).

Everything the plan lists is implemented; RLS policies, composite FKs, grants and `save_flashcard` (security invoker, empty search_path, no dynamic SQL) were checked and are correct. Note: the migration is already applied in production, so any schema fix below needs a **new additive migration**, never an edit of `20261110210825_flashcard_data_contract.sql`.

## Findings

### F1 — Tabs and newlines escape the word/tag key folding

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261110210825_flashcard_data_contract.sql:14, 21-22, 31, 33, 162, 177, 185-191
- **Detail**: `btrim(x)` without a second argument strips only spaces, while `regexp_replace(…, '\s+', ' ')` turns tabs/newlines into a space. Verified on local Postgres: `"\tgive up"` gets `word_key = ' give up'`, so it becomes a second card for "give up" (breaks FR-005), and a word, translation or tag name consisting only of `"\t"` passes the length checks (`char_length(btrim(E'\t')) = 1`). The anon key is public, so callers can bypass any API-route trimming.
- **Fix**: New migration that collapses first, then trims — `btrim(regexp_replace(x, '\s+', ' ', 'g'))` — in both generated keys (PG17 `alter column … set expression`), the length checks and `save_flashcard`; plus a `check-rls` step saving `"\tgive up"` that must return the existing card.
  - Strength: Fixes the rule at the only enforcement point, so S-01/S-04/S-09 inherit it.
  - Tradeoff: A second migration and another production `db push` before S-01 ships.
  - Confidence: HIGH — reproduced on the local database.
  - Blind spot: Existing production rows with tab-prefixed words (none expected — no slice writes data yet).
- **Decision**: FIXED — new migration 20261110221827_flashcard_key_folding.sql (collapse-then-trim in keys, CHECKs, save_flashcard) + 2 check-rls steps (break-checked: red without the migration)

### F2 — No size limits on text, arrays and tag count

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261110210825_flashcard_data_contract.sql:15-17, 144
- **Detail**: `translation`, `example_sentence`, the number and length of `additional_meanings`, and the number of `p_tag_names` are unbounded. Any signed-in user can call PostgREST/RPC directly; 10,000 tag names means ~30,000 statements in one transaction.
- **Fix**: In the same new migration, add CHECKs (e.g. translation ≤ 500, example ≤ 500, `cardinality(additional_meanings) <= 10`, each ≤ 200) and reject `array_length(p_tag_names, 1) > 20` inside `save_flashcard`.
  - Strength: Bounds storage and per-call work regardless of which slice or client calls.
  - Tradeoff: Limit values are a product choice; too tight would reject legitimate AI output.
  - Confidence: MED — limits are judgement calls; current AI output is far below them.
  - Blind spot: Longest translations the models actually produce not measured.
- **Decision**: FIXED — same migration: translation/example ≤ 500, ≤ 10 meanings and ≤ 2000 chars total, ≤ 20 tags per save_flashcard call + check-rls step

### F4 — listFlashcards is silently capped at 1,000 rows

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/flashcards.service.ts:106-116, supabase/config.toml:18 (`max_rows = 1000`)
- **Detail**: No pagination is fine at MVP scale, but past 1,000 cards PostgREST drops rows without an error.
- **Fix**: Record the limit in contract-surfaces.md now; add `.range()` paging when S-05 builds the list.
- **Decision**: FIXED — 1,000-row cap documented in contract-surfaces.md; paging left to S-05

### F5 — Opposite tag order in parallel saves can deadlock

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261110210825_flashcard_data_contract.sql:184-201
- **Detail**: Two concurrent saves of different words with new tags in opposite order (`[X, Y]` vs `[Y, X]`) can make Postgres abort one with 40P01. Same-word saves are safe. Rare for a single user, but S-01 may save cards in parallel.
- **Fix**: In the F1/F2 migration, iterate over distinct tag keys sorted by key.
- **Decision**: SKIPPED

### F6 — check-rls does not cover "write someone else's user_id"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/check-rls.mjs
- **Detail**: Policies are correct (WITH CHECK on insert/update), but nothing locks them in: B updating its own card's `user_id` to A's id, B inserting a card with `user_id: A`, and an anonymous insert are not tested.
- **Fix**: Add those three steps to `scripts/check-rls.mjs`.
- **Decision**: SKIPPED

### F7 — Clients can update id and created_at of their own rows

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261110210825_flashcard_data_contract.sql:10-49
- **Detail**: Supabase's default grants allow `authenticated` to UPDATE every column; a user can rewrite `id` or `created_at` of their own cards (not other users' — WITH CHECK holds).
- **Fix**: `revoke update (id, user_id, created_at) on public.flashcards, public.tags from authenticated` in the follow-up migration.
- **Decision**: SKIPPED

### F8 — `*` in a tag prefix acts as a wildcard

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/flashcards.service.ts:77-79, 164
- **Detail**: `escapeLike` handles `\ % _`, but PostgREST also turns `*` into `%` in `like` filters, so prefix `a*b` matches more than intended (only the user's own tags).
- **Fix**: Strip or escape `*` in `escapeLike`.
- **Decision**: FIXED — suggestTags drops "*" from the prefix + unit test (break-checked)

### F9 — Error text from save_flashcard includes the word

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261110210825_flashcard_data_contract.sql:180
- **Detail**: The "not found after conflict" exception embeds `p_word`. It only reaches the user who sent it and the service strips messages (tested), so nothing leaks; it would only show up in logs if a future caller logs raw Postgres errors.
- **Fix**: Drop `p_word` from the message in the follow-up migration.
- **Decision**: SKIPPED (no separate change needed — the F1 migration already raises the error without the word)
