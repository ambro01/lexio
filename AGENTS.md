# AGENTS.md

**Lexio** is an AI flashcard app: it turns English lesson PDFs or pasted text into English→Polish flashcards with spaced review. Product scope lives in `context/foundation/prd.md`, and stack rationale lives in `context/foundation/tech-stack.md`. Read the PRD before building features. The repo is still the bare 10x Astro Starter (auth only), with no domain code yet.

## Hard rules

- **Supabase migrations**: `supabase/migrations/` (doesn't exist yet; create it with `npx supabase migration new <name>`) using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`). Both are `optional`, and `createClient()` **returns `null` when they are missing**. The app still boots, with auth disabled and a banner driven by `src/lib/config-status.ts`. Every caller must handle the `null` client (see `src/pages/api/auth/signin.ts`).
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod. zod is not a direct dependency yet, so run `npm i zod` before the first use. The existing auth endpoints don't validate input yet.
- Auth endpoints are plain HTML form POSTs that answer with redirects (errors go in the `?error=` query param), not JSON.
- **Never write to `context/archive/`.** Archived changes are immutable. If a target path starts with `context/archive/`, stop with: "This change is archived. Open a new change with `/10x-new` instead."

## Commands

Standard scripts (`dev`, `build`, `preview`, `lint`, `lint:fix`, `format`) are in `package.json`. Not obvious from there:

- `npm run smoke` — dependency-free auth-flow smoke test (`scripts/smoke.mjs`) against a running server, `BASE_URL` env (default `http://localhost:4321`). Run after dependency upgrades.
- `npx astro check` — type-check `.astro`/`.ts` files. CI order: `astro sync` → lint → `astro check` → build, plus a smoke job against the production preview with a local Supabase (see `.github/workflows/ci.yml`). The CI build needs the `SUPABASE_URL` and `SUPABASE_KEY` repo secrets.

There is no unit-test runner yet. `npm run smoke` is the only automated test.

## Architecture

### Auth flow

- `context.locals.user` is typed in `src/env.d.ts`. Add new `Locals` fields there.
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- Auth routes and pages: see the "Auth routes" table in `README.md`.

### Key conventions

- **Astro vs React**: write a `.tsx` component only if it uses state, effects or event handlers (`useState`, `useEffect`, `onClick`, form handling). Everything else is `.astro`. Mount islands with `client:load` (as in `src/pages/auth/signin.astro`).
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: configured in `components.json`. Add components with `npx shadcn@latest add <name>`.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services vs helpers**: code that does I/O (Supabase queries, LLM calls) and is called from API routes goes in `src/lib/services/<domain>.service.ts` (e.g. `flashcards.service.ts`). Pure helpers without I/O go in `src/lib/`.
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Env vars, local Supabase, `.dev.vars` and deploy: see `README.md` ("Getting Started", "Supabase Configuration", "Deployment").

<!-- The 10x CLI (`@przeprogramowani/10x-cli`) may append a managed block below on sync. Put project rules above it. -->

## Lessons learned

Look at: `context/foundation/lessons.md`
