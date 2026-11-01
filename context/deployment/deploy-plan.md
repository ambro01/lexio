---
project: lexio
platform: Cloudflare Workers (+ Static Assets)
production_url: https://lexio.rafalambro.workers.dev
worker_name: lexio
first_deployed_at: 2026-11-01
auto_deploy: Workers Builds (Cloudflare Git integration), branch master
sources:
  - context/foundation/infrastructure.md
  - context/foundation/tech-stack.md
---

# Deploy plan: first deployment of Lexio

Source of truth for "what is already deployed and which secrets are wired". Pages commands (`wrangler pages deploy`) are **not** used — the adapter `@astrojs/cloudflare` ≥ 13 targets Workers only; deploy is always `npx wrangler deploy`.

## Decisions

- First deploy manual (`wrangler deploy` from the developer machine), then auto-deploy on push to `master`.
- Auto-deploy is handled by the platform (**Workers Builds**), not by GitHub Actions. `.github/workflows/ci.yml` stays a quality gate (lint, `astro check`, build, smoke on local Supabase) with no deploy step and no Cloudflare token in GitHub.
- Production Supabase: a new hosted project (EU region). No migrations exist yet.
- Non-production branch builds are disabled: preview URLs are public and would use production Supabase.

## Steps

### A. Repo changes (agent)

- [x] `wrangler.jsonc`, `package.json`, `package-lock.json`: name `lexio`.
- [x] `astro.config.mjs`: `session: false` — no auto-provisioned KV `SESSION` binding (verified: `kv_namespaces: []` in `dist/server/wrangler.json`).
- [x] `tech-stack.md`: `deployment_target: cloudflare-workers`.
- [x] `npx astro check` 0 errors, `npm run build` OK. `npm run lint` fails locally only on CRLF line endings (`core.autocrlf=true` on Windows, pre-existing); CI on Linux is unaffected.

### B. Supabase (human)

- [x] Hosted project created.
- [x] Auth → URL Configuration: `Site URL` = `https://lexio.rafalambro.workers.dev`, same URL in Redirect URLs.
- [x] Email confirmations left enabled.

### C. Cloudflare CLI (human)

- [x] `npx wrangler login` (OAuth), verified with `npx wrangler whoami`.

### D. First manual deploy

- [x] `npm run build && npx wrangler deploy` → `https://lexio.rafalambro.workers.dev`, version `09c574ca-cbda-49ba-8276-a83e329ffe39`. Bindings: `ASSETS`, `IMAGES`.
- [x] Secrets via `npx wrangler secret put` (human): `SUPABASE_URL`, `SUPABASE_KEY` (publishable/anon key, never `service_role`).
- [x] Gotcha fixed: `SUPABASE_URL` must be the bare `https://<ref>.supabase.co` — a path suffix (`/rest/v1/`) makes Supabase Auth return "Invalid path specified in request URL".

### E. Auto-deploy via Workers Builds (human, dashboard)

- [x] Workers & Pages → `lexio` → Settings → Builds → Connect → GitHub repo `ambro01/lexio`, production branch `master`.
- [x] Build command `npm run build`, deploy command `npx wrangler deploy`, root directory `/`.
- [ ] If the build fails on Node version (`.nvmrc` = `26.13.0`), add build variable `NODE_VERSION` with a version supported by the build image (e.g. `22`).
- [x] Disable builds for non-production branches.
- [ ] Commit + push to `master` → first Workers Builds deployment appears in `npx wrangler deployments list`.

## Verification (production)

- [x] `GET /` → 200; `GET /auth/signin`, `/auth/signup` → 200.
- [x] `GET /dashboard` (anonymous) → 302 `/auth/signin`.
- [x] `POST /api/auth/signin` with a wrong password → 302 `?error=Invalid login credentials` (Worker ↔ Supabase works, no user created).
- [x] Manual: sign up with a real email → confirmation email → sign in → `/dashboard`.
- Do **not** run `npm run smoke` against production: it creates throwaway users and assumes email confirmation is off.

## Operations

- Logs: `npx wrangler tail --format pretty` (watch for CPU-limit 1102 / 5xx).
- History: `npx wrangler deployments list`, `npx wrangler versions list`.
- Rollback (human approval): `npx wrangler rollback <version-id>`. Supabase migrations do not roll back with the Worker.
- Secret rotation (human): `npx wrangler secret put <NAME>`, then revoke the old key in Supabase.
- Wired secrets: `SUPABASE_URL`, `SUPABASE_KEY`. LLM API key not yet added (first feature slice).
