# Flashcard Data Contract — Plan Brief

> Full plan: `context/changes/flashcard-data-contract/plan.md`

## What & Why

Lexio's first database schema (roadmap F-02): flashcards and tags stored per user, one flashcard per word per user, many tags per flashcard, and no user can see another user's data. Isolation has to exist before any slice writes user data, and S-01, S-04 and S-05 all need the same "save the word or add the tag" rule.

## Starting Point

There are no tables and no migrations yet — only Supabase auth. The Worker talks to Supabase with the anon key only, so row-level security is the sole isolation boundary. CI already starts a local Supabase for the smoke test, which applies migrations automatically.

## Desired End State

`flashcards`, `tags` and `flashcard_tags` exist locally and in production with RLS on every table. Saving "give up" when "Give up" exists adds the new tag to the existing card instead of creating a duplicate. A two-user check in CI proves that user B cannot read, change, delete or tag user A's data, and later slices call one typed service instead of writing SQL.

## Key Decisions Made

| Decision         | Choice                                                                         | Why (1 sentence)                                                                                                |
| ---------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Word identity    | Lowercase + trim + collapse inner spaces; unique per user                      | Matches FR-005 and the AI parser's existing dedupe; "bank" is one card, other senses go to additional meanings. |
| Tag model        | `tags` table (same key folding) + `flashcard_tags` link table                  | Tag suggestions and review by tag are plain queries; renaming later is one row.                                 |
| Deletion         | Hard delete; links cascade; tags stay; account deletion removes all            | Simple, no triggers; quality stats live in S-01's own records, not on the card.                                 |
| Card columns     | The AI proposal fields 1:1, CEFR nullable, timestamps; no origin flag          | S-01 and S-04 save the existing shape without another migration.                                                |
| Write path       | One `save_flashcard` SQL function (security invoker)                           | Atomic: a card never ends up without its lesson tag; one round-trip per card.                                   |
| Cross-user links | Composite foreign keys `(id, user_id)` on the link table                       | A link between different users' card and tag cannot exist, independent of policies.                             |
| F-02 reach       | Schema + RLS + types + `flashcards.service.ts`; no API or UI                   | Later slices reuse one tested write path.                                                                       |
| Verification     | `check-rls.mjs` two-user script in CI; manual `supabase db push` to production | Tests the real anon-key path; no database credentials in CI.                                                    |

## Scope

**In scope:**

- Migration with three tables, key columns, constraints, RLS policies per operation, `save_flashcard`
- `scripts/check-rls.mjs` + CI step
- `npm run db:types`, typed client, `src/types.ts`, `flashcards.service.ts` + unit tests
- Production migration (human) and docs, including a new `docs/reference/contract-surfaces.md`

**Out of scope:**

- API routes and UI (S-01, S-04, S-05)
- Review scheduling, "Opanowane", acceptance/rejection records, rejected-words list (S-06, S-01, S-03, S-09)
- Lemmatisation, soft delete, automatic removal of unused tags, tag rename/merge
- pgTAP, schema-drift check, automated production migrations

## Architecture / Approach

Guarantees live in Postgres: generated key columns for uniqueness, composite foreign keys for same-user links, one RLS rule (`user_id = auth.uid()`) on every table, and a `security invoker` function for the only multi-step write. TypeScript stays thin — a typed client and a service whose functions take the client as a parameter, so Vitest can test them without Astro.

## Phases at a Glance

| Phase                            | What it delivers                                                        | Key risk                                                        |
| -------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Schema, RLS and save function | Migration + two-user isolation check in CI                              | A policy gap that only a negative test reveals                  |
| 2. Types and flashcards service  | `db:types`, typed client, DTOs, service with error mapping + tests      | Service API designed before its first caller (S-01)             |
| 3. Production and docs           | Migration on production, deploy plan, README, AGENTS, contract register | Forgetting `db push` before a slice that needs the tables ships |

**Prerequisites:** Docker + local Supabase (`npx supabase start`); for Phase 3, access to the production Supabase project (database password stays with the user).
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Inflected forms from the AI ("wilting" vs "wilt") will be separate cards — accepted; S-01 may tighten the prompt.
- `supabase gen types` output may need excluding from lint/format; handled in Phase 2.
- Production schema changes are manual; the deploy-plan rule ("db push before code that needs it") must be followed by later slices.

## Success Criteria (Summary)

- `npm run check:rls` passes in CI: two users, full isolation, one card per word, tags merged.
- Later slices can save, list, edit and delete flashcards through `flashcards.service.ts` with typed inputs.
- The schema exists in production with RLS on all three tables.
