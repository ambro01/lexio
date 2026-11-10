# Flashcard Data Contract Implementation Plan

## Overview

Create Lexio's first database schema (roadmap F-02): per-user `flashcards` and `tags` with a link table, row-level security on every table, one flashcard per word per user, and a single atomic "save the word or add the tag if it already exists" function. Expose it through generated types and `src/lib/services/flashcards.service.ts` so S-01 (paste text), S-04 (manual word) and S-05 (collection) share one tested write path. Isolation is proven in CI by a two-user check against local Supabase; the migration reaches production through a manual `supabase db push`.

## Current State Analysis

- No schema at all: `supabase/` holds only `config.toml` (no `migrations/`, no `seed.sql` — `config.toml:53-65` enables both), and `README.md:115` says "No database tables or migrations are required — auth.users only".
- The Worker uses only the anon/publishable key (`src/lib/supabase.ts:5-21`, `context/deployment/deploy-plan.md:46`); there is no `service_role` anywhere, so RLS is the only isolation boundary.
- `createClient(requestHeaders, cookies)` returns an untyped `@supabase/ssr` client or `null` when env is missing; routes create it themselves (`locals.supabase` is not exposed — `src/middleware.ts:6-24`, `src/env.d.ts:1-5`).
- No generated DB types, no `src/types.ts`, no npm script touching Supabase (`package.json`).
- CI's `smoke` job runs `supabase start` on a fresh database (`.github/workflows/ci.yml:42`), which applies `supabase/migrations/*` automatically, then writes `API_URL`/`ANON_KEY` to `.env`/`.dev.vars` (`ci.yml:43-48`). Local auth has email confirmations off (`config.toml:209`), so tests can sign up users directly.
- The proposal shape later slices will save already exists: `{ word, translation, additionalMeanings: string[], exampleSentence, cefr: "A1"…"C2" }` (`src/lib/ai/proposals.ts:8`); the parser already de-duplicates words case-insensitively within one response (`src/lib/ai/proposals.ts:123`).
- Conventions: migrations in `supabase/migrations/YYYYMMDDHHmmss_short_description.sql` via `npx supabase migration new`, RLS on every table with granular per-operation, per-role policies (`AGENTS.md:7`); I/O code in `src/lib/services/<domain>.service.ts` (`AGENTS.md:36`); shared entity/DTO types in `src/types.ts` (`AGENTS.md:37`); tests must not import `astro:*` (`AGENTS.md:24`).
- Production: hosted EU Supabase project with no migrations yet (`deploy-plan.md:21`); migrations do not roll back with the Worker and must stay backward-compatible (`context/foundation/infrastructure.md:93-94`).

## Desired End State

- Three tables in `public` — `flashcards`, `tags`, `flashcard_tags` — each with RLS enabled and per-operation policies for `authenticated` only; `anon` sees nothing.
- A user can never read, change, delete or tag another user's flashcards or tags, and a link between a card and a tag of different users cannot exist at all (enforced by foreign keys, not only by policy).
- A word exists once per user: "Give up", "give up" and "give up" are the same card. Saving an existing word keeps its content and only adds the new tags.
- `save_flashcard(...)` does insert-or-find plus tag creation plus linking in one transaction under the caller's RLS.
- `npm run db:types` regenerates `src/db/database.types.ts`; the server client is typed; `src/types.ts` exports `Flashcard`, `Tag` and the save input DTO.
- `src/lib/services/flashcards.service.ts` offers save-or-tag, list (with tags), update, delete and tag suggestions, with typed errors.
- `npm run check:rls` passes in CI against local Supabase; the migration is applied on production and recorded in the deploy plan.

Verify with: `npx supabase db reset` (applies cleanly), `npm run check:rls`, `npm test`, `npx astro check`, `npm run build`, `npm run smoke`, and the production table list in the Supabase dashboard.

### Key Discoveries:

- Migration/RLS convention: `AGENTS.md:7`.
- CI applies migrations implicitly through `supabase start`: `.github/workflows/ci.yml:42`.
- Anon-key-only client: `src/lib/supabase.ts:5-21` — RLS must carry isolation.
- Proposal shape to store 1:1: `src/lib/ai/proposals.ts:8`.
- Node 26 runs `.ts` imports natively (used by `scripts/measure-generation.mjs`), but only when the imported module has no runtime `@/` imports.

## What We're NOT Doing

- No API routes and no UI — S-01/S-04/S-05 add their own endpoints and screens on top of the service.
- No review-scheduling state, no "Opanowane" flag (S-06), no acceptance/rejection records and no rejected-words list (S-01, S-03, S-09), no origin (`ai`/`manual`) column — FR-013 reads S-01's acceptance records, not the card.
- No lemmatisation: "wilting" and "wilt" are different words; same spelling with a different meaning ("bank") is one card with the other meaning in `additional_meanings`.
- No soft delete and no automatic removal of tags left without cards; tag rename/merge/delete is S-05.
- No tag-to-card editing primitives beyond save-or-tag (adding/removing a tag on an existing card is S-05).
- No pgTAP, no schema-drift check in CI, no seed data.
- No automated production migrations — no database credentials in CI or Workers Builds.
- No rename of `project_id = "10x-astro-starter"` in `supabase/config.toml` (changes CI container names; unrelated).

## Implementation Approach

Put the guarantees in the database, where every later caller inherits them: generated key columns for word and tag uniqueness, composite foreign keys so card/tag/link always share one `user_id`, RLS with one rule (`user_id = auth.uid()`), and a `security invoker` SQL function for the only multi-step write. TypeScript stays thin: a typed client and a service whose functions take the client as a parameter (testable without Astro). Prove isolation through the same anon-key client the app uses, in CI, before any slice writes user data.

## Critical Implementation Details

- **Ownership through composite keys**: `flashcards` and `tags` each get a unique `(id, user_id)`; `flashcard_tags(flashcard_id, tag_id, user_id)` references `flashcards(id, user_id)` and `tags(id, user_id)` with `on delete cascade`. A mixed-user link is then impossible at the constraint level, and the link table's RLS can use the same `user_id = auth.uid()` rule as the other tables.
- **Function safety**: `save_flashcard` must be `security invoker` with `set search_path = ''` and fully qualified names, so RLS applies to every statement inside it; revoke `execute` from `public`/`anon`, grant to `authenticated`. Concurrent saves of the same word rely on `insert … on conflict (user_id, word_key) do nothing` followed by a select — never a check-then-insert.
- **Ordering**: apply the migration to production (Phase 3) before any slice that calls the service is deployed. F-02 itself ships no code path that touches the tables in production, so its own deploy order is safe either way.

## Phase 1: Schema, RLS and save function

### Overview

The migration with the three tables, keys, constraints, policies and `save_flashcard`, plus a two-user isolation check that runs in the CI smoke job.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_flashcard_data_contract.sql` (created with `npx supabase migration new flashcard_data_contract`)

**Intent**: Create per-user flashcard and tag storage whose uniqueness and isolation rules are enforced by Postgres, so no caller can break them.

**Contract**:

- `public.flashcards`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `word text not null` (as displayed), `word_key text generated always as (lower(regexp_replace(btrim(word), '\s+', ' ', 'g'))) stored`, `translation text not null`, `additional_meanings text[] not null default '{}'`, `example_sentence text not null default ''`, `cefr text null check (cefr in ('A1','A2','B1','B2','C1','C2'))`, `created_at`/`updated_at timestamptz not null default now()`. Checks: `char_length(btrim(word))` 1–100, `char_length(btrim(translation))` ≥ 1. Unique `(user_id, word_key)`; unique `(id, user_id)`.
- `public.tags`: `id`, `user_id` (same default/FK), `name text not null` (as first typed), `name_key` generated the same way as `word_key`, `created_at`. Check `char_length(btrim(name))` 1–50. Unique `(user_id, name_key)`; unique `(id, user_id)`.
- `public.flashcard_tags`: `flashcard_id`, `tag_id`, `user_id uuid not null default auth.uid()`, `created_at`; pk `(flashcard_id, tag_id)`; FK `(flashcard_id, user_id) → flashcards(id, user_id) on delete cascade`; FK `(tag_id, user_id) → tags(id, user_id) on delete cascade`; index on `(tag_id)` for review-by-tag.
- `updated_at` trigger on `flashcards`.
- RLS enabled on all three; for role `authenticated`, separate `select`, `insert`, `update`, `delete` policies with `user_id = (select auth.uid())` in `using` and/or `with check` (`flashcard_tags` needs no `update` policy — links are inserted and deleted only). No policies for `anon`.
- `public.save_flashcard(p_word text, p_translation text, p_additional_meanings text[], p_example_sentence text, p_cefr text, p_tag_names text[]) returns table (flashcard_id uuid, created boolean)`, `language plpgsql security invoker set search_path = ''`: insert the card with `on conflict (user_id, word_key) do nothing`; if nothing was inserted, select the existing card by key and leave its content untouched (`created = false`); for each non-blank tag name insert into `tags … on conflict (user_id, name_key) do nothing`, resolve ids by `name_key`, then insert links `on conflict do nothing`. `execute` revoked from `public, anon`, granted to `authenticated`.

#### 2. Isolation check script

**File**: `scripts/check-rls.mjs`, `package.json`, `.github/workflows/ci.yml`

**Intent**: Prove isolation and the one-word rule through the same anon-key client the app uses, on every push, before any slice writes user data.

**Contract**: Node script using `@supabase/supabase-js` (already a dependency), reading `SUPABASE_URL`/`SUPABASE_KEY` from env (fail with exit 2 if missing); signs up two fresh users (`rls-a-<ts>@example.com`, `rls-b-<ts>@example.com`) with separate clients; prints `PASS`/`FAIL` per step like `scripts/smoke.mjs` and exits non-zero on any failure. Steps:

- A: `save_flashcard('Give up', …, ['Lesson 1'])` → `created = true`.
- A: `save_flashcard('give  up', 'inna treść', …, ['lesson 1', 'Lesson 2'])` → same id, `created = false`, translation unchanged, tags exactly `Lesson 1` + `Lesson 2` (no duplicate tag from `lesson 1`).
- B: select on all three tables returns no rows of A; select A's card by id returns nothing.
- B: update and delete of A's card affect 0 rows (A's card still intact afterwards, checked as A).
- B: insert into `flashcard_tags` with A's card id and B's own tag fails; with B's card and A's tag fails.
- B: `save_flashcard('give up', …)` creates B's own card (`created = true`) — keys are per user.
- Anonymous client: select on all three tables returns no rows; `save_flashcard` is rejected.
- A deletes the card → its links are gone, the tags remain.

Script `"check:rls": "node scripts/check-rls.mjs"`; CI `smoke` job runs it after `supabase start` with the local `API_URL`/`ANON_KEY` as `SUPABASE_URL`/`SUPABASE_KEY` (before or after the smoke step).

### Success Criteria:

#### Automated Verification:

- Migration applies on a fresh local database: `npx supabase db reset`
- Isolation and one-word checks pass: `npm run check:rls`
- Smoke test still passes: `npm run smoke` (against `npm run preview` with local Supabase)

#### Manual Verification:

- Supabase Studio (local) shows RLS enabled on `flashcards`, `tags` and `flashcard_tags`, and `save_flashcard` is executable only by `authenticated`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 2: Types and flashcards service

### Overview

Generated DB types, a typed server client, shared DTOs and the flashcards service that later slices call.

### Changes Required:

#### 1. Generated types and typed client

**File**: `package.json`, `src/db/database.types.ts`, `src/lib/supabase.ts`, `eslint.config.js` (if needed)

**Intent**: Make table and function shapes compile-time checked for every caller, regenerated by one command.

**Contract**: script `"db:types": "supabase gen types typescript --local > src/db/database.types.ts"`; the generated file is committed and excluded from ESLint/Prettier if they reject generated output; `createServerClient<Database>(…)` in `src/lib/supabase.ts` so `createClient` returns `SupabaseClient<Database> | null`; existing auth routes still compile unchanged.

#### 2. Shared entity types

**File**: `src/types.ts`

**Intent**: One place for the entity and input shapes the service, API routes and UI share (`AGENTS.md:37`).

**Contract**: `Flashcard` (`id`, `word`, `translation`, `additionalMeanings: string[]`, `exampleSentence`, `cefr: CefrLevel | null`, `tags: Tag[]`, `createdAt`, `updatedAt`), `Tag` (`id`, `name`), `SaveFlashcardInput` (`word`, `translation`, `additionalMeanings`, `exampleSentence`, `cefr: CefrLevel | null`, `tagNames: string[]`), `UpdateFlashcardInput` (partial of the content fields, no tags). `CefrLevel` reused from `src/lib/ai/proposals.ts`. Type-only imports so Node can load modules importing it.

#### 3. Flashcards service

**File**: `src/lib/services/flashcards.service.ts`

**Intent**: The single write and read path for flashcards, so the one-word rule and tag merge live in one place and callers deal with domain types, not rows.

**Contract** (every function takes `client: SupabaseClient<Database>` first; no `astro:*` imports):

- `saveFlashcard(client, input: SaveFlashcardInput): Promise<{ id: string; created: boolean }>` — calls `save_flashcard`.
- `listFlashcards(client): Promise<Flashcard[]>` — cards with their tags in one query, newest first.
- `updateFlashcard(client, id, patch: UpdateFlashcardInput): Promise<Flashcard>` — throws `DuplicateWordError` when the new word collides with another card (Postgres `23505`), `FlashcardNotFoundError` when no row is visible.
- `deleteFlashcard(client, id): Promise<void>` — `FlashcardNotFoundError` when nothing was deleted.
- `suggestTags(client, prefix?: string): Promise<Tag[]>` — user's tags ordered by name, filtered case-insensitively by prefix, limit 20.
- Any other Supabase error → `FlashcardStoreError` (message without user content).

#### 4. Unit tests

**File**: `src/lib/services/flashcards.service.test.ts`

**Intent**: Lock the error mapping and row-to-domain mapping without a database (the database behaviour is covered by `check:rls`).

**Contract**: Vitest with a hand-made stub client: `saveFlashcard` passes snake_case args and maps the result; `updateFlashcard` maps `23505` → `DuplicateWordError` and an empty result → `FlashcardNotFoundError`; `deleteFlashcard` with 0 rows → `FlashcardNotFoundError`; `listFlashcards` maps nested tags; generic error → `FlashcardStoreError`.

### Success Criteria:

#### Automated Verification:

- Types regenerate without diff: `npm run db:types` followed by `git diff --exit-code src/db/database.types.ts`
- Unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Build succeeds: `npm run build`
- Isolation checks still pass: `npm run check:rls`

#### Manual Verification:

- `src/types.ts` and the service function list match what S-01 (save accepted proposals with a lesson tag) and S-05 (list, edit, delete, tag suggestions) need

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Production and docs

### Overview

Apply the migration to the production project and document the schema, the commands and the production migration step.

### Changes Required:

#### 1. Production migration (human gate)

**File**: none (platform)

**Intent**: Make the schema exist in production before any slice deploys code that uses it.

**Contract**: human runs `npx supabase link --project-ref <ref>` (once) and `npx supabase db push`; the agent never handles the database password. Verify in the dashboard that the three tables exist with RLS enabled.

#### 2. Documentation

**File**: `context/deployment/deploy-plan.md`, `README.md`, `AGENTS.md`, `docs/reference/contract-surfaces.md`

**Intent**: Record what is now deployed, how migrations reach production, and the names other slices depend on.

**Contract**:

- `deploy-plan.md`: new step recording the first migration applied to production (date, migration file) and an Operations rule: "migrations go to production with `npx supabase db push` before pushing code that needs them; additive only".
- `README.md:115`: replace the "no tables required" line with the schema summary and the local commands (`npx supabase db reset`, `npm run db:types`, `npm run check:rls`).
- `AGENTS.md`: list `npm run db:types` and `npm run check:rls`; note that `src/db/database.types.ts` is generated.
- `docs/reference/contract-surfaces.md` (new): table names, `save_flashcard` signature, the word/tag key rule (lowercase, trimmed, inner whitespace collapsed) and the service function names, each with the slice that relies on it.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Build succeeds: `npm run build`

#### Manual Verification:

- Production Supabase dashboard shows `flashcards`, `tags` and `flashcard_tags` with RLS enabled, and `supabase migration list` shows the migration applied remotely
- `deploy-plan.md`, `README.md`, `AGENTS.md` and `contract-surfaces.md` describe the schema and the production migration step

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Service error mapping: duplicate word on update, not found on update/delete, generic store error.
- Row-to-domain mapping including nested tags and nullable CEFR.

### Integration Tests:

- `npm run check:rls` against local Supabase in CI: two users, every table, the save function, the anonymous client, cascade on delete, and the word/tag key folding ("Give up" / "give up", "Lesson 1" / "lesson 1").
- `npm run smoke` keeps guarding auth and routing.

### Manual Testing Steps:

1. `npx supabase db reset` locally, open Studio, confirm RLS and policies on all three tables.
2. Run `npm run check:rls` and read the step list.
3. After `supabase db push`, confirm the tables and RLS in the production dashboard.

## Performance Considerations

Small per-user data (hundreds to low thousands of cards). Unique indexes on `(user_id, word_key)` and `(user_id, name_key)` serve both uniqueness and lookups; `flashcard_tags(tag_id)` serves review by tag. One RPC per saved card keeps S-01's accept step to one round-trip per card; batching can come later if needed.

## Migration Notes

First migration, purely additive, no existing data. Rollback on production would be a manual `drop` of the function and the three tables (data loss) — not expected; later schema changes go in new additive migrations. The Worker rollback (`wrangler rollback`) does not touch the database.

## References

- Roadmap item: `context/foundation/roadmap.md` (F-02 `flashcard-data-contract`)
- PRD: FR-005, FR-007, FR-008, NFR isolation, Access Control (`context/foundation/prd.md`)
- Conventions: `AGENTS.md:7`, `AGENTS.md:24`, `AGENTS.md:36-37`
- Client and middleware: `src/lib/supabase.ts:5-21`, `src/middleware.ts:6-24`
- CI smoke job: `.github/workflows/ci.yml:28-56`
- Proposal shape: `src/lib/ai/proposals.ts:8`
- Script pattern: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, RLS and save function

#### Automated

- [x] 1.1 Migration applies on a fresh local database: `npx supabase db reset`
- [x] 1.2 Isolation and one-word checks pass: `npm run check:rls`
- [x] 1.3 Smoke test still passes: `npm run smoke` (against `npm run preview` with local Supabase)

#### Manual

- [x] 1.4 Supabase Studio (local) shows RLS enabled on `flashcards`, `tags` and `flashcard_tags`, and `save_flashcard` is executable only by `authenticated`

### Phase 2: Types and flashcards service

#### Automated

- [ ] 2.1 Types regenerate without diff: `npm run db:types` followed by `git diff --exit-code src/db/database.types.ts`
- [ ] 2.2 Unit tests pass: `npm test`
- [ ] 2.3 Type checking passes: `npx astro check`
- [ ] 2.4 Build succeeds: `npm run build`
- [ ] 2.5 Isolation checks still pass: `npm run check:rls`

#### Manual

- [ ] 2.6 `src/types.ts` and the service function list match what S-01 (save accepted proposals with a lesson tag) and S-05 (list, edit, delete, tag suggestions) need

### Phase 3: Production and docs

#### Automated

- [ ] 3.1 Unit tests pass: `npm test`
- [ ] 3.2 Build succeeds: `npm run build`

#### Manual

- [ ] 3.3 Production Supabase dashboard shows `flashcards`, `tags` and `flashcard_tags` with RLS enabled, and `supabase migration list` shows the migration applied remotely
- [ ] 3.4 `deploy-plan.md`, `README.md`, `AGENTS.md` and `contract-surfaces.md` describe the schema and the production migration step
