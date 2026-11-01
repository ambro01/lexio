---
project: lexio
researched_at: 2026-10-29
recommended_platform: Cloudflare Workers (+ Static Assets)
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7.3 (SSR, output "server") + React 19
  runtime: Cloudflare workerd (nodejs_compat), adapter @astrojs/cloudflare 14.3.1, wrangler 4.131.1
---

## Recommendation

**Deploy on Cloudflare Workers (with Static Assets).**

The project is already configured for it (adapter, `wrangler.jsonc`, CI), it is the only shortlisted platform that costs $0 at Lexio's traffic while still allowing commercial use, and it handles the one demanding workload — a ~60 s streamed LLM call to generate flashcards — without a wall-clock limit, because time spent waiting on `fetch()` is not billed as CPU. It scored 5/5 Pass on the agent-friendly criteria. Interview answers that drove the decision: no always-on processes (generation is a live, streamed request the user watches), cost minimisation as top priority, no prior platform familiarity, single region (Poland/EU), external Supabase. The main constraint — 10 ms CPU per request on the Free plan — is handled by extracting PDF text in the browser, with the $5/month Paid plan as the fallback.

Note: `tech-stack.md` lists `deployment_target: cloudflare-pages`. The adapter dropped Pages support in v13; the real target is **Workers + Static Assets**, which is what `wrangler.jsonc` already configures.

## Platform Comparison

Scoring: Pass = 2, Partial = 1, Fail = 0. Researched 2026-10-29 with live web sources.

| Platform           | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total  | Est. cost (10k–100k req/mo)                |
| ------------------ | --------- | ------------------ | ------------------- | ----------------- | ----------------- | ------ | ------------------------------------------ |
| Cloudflare Workers | Pass      | Pass               | Pass                | Pass              | Pass              | **10** | $0 Free / $5 Paid                          |
| Vercel             | Pass      | Pass               | Pass                | Partial           | Pass              | **9**  | $0 Hobby (non-commercial) / $20 Pro        |
| Netlify            | Partial   | Pass               | Pass                | Partial           | Pass              | 8      | $0–9 (EU region needs $20 Pro)             |
| Fly.io             | Pass      | Pass               | Pass                | Partial           | Partial           | 8      | ~$1–4 (no free tier)                       |
| Railway            | Partial   | Pass               | Pass                | Partial           | Partial           | 7      | ~$5                                        |
| Render             | Partial   | Pass               | Pass                | Partial           | Partial           | 7      | $7 (free tier unusable: ~1 min cold start) |

Long-request fit (generation must finish < 60 s with streamed progress) was assessed separately, since it is the NFR most likely to break:

- **Cloudflare** — unlimited wall-clock while the client is connected; I/O wait is not CPU. Free: 10 ms CPU/request; Paid: up to 5 min CPU (default 30 s).
- **Vercel** — 300 s max on Hobby (Fluid compute, Node). Waiting counts against provisioned memory hours.
- **Netlify** — hard 60 s sync/streaming timeout. Zero margin against the 60 s target.
- **Fly.io / Railway / Render** — persistent containers; proxies close idle connections (Fly 60 s idle, Railway 5 min idle / 15 min max, Render ~100 min per staff forum). Fine with streaming.

**Cloudflare Workers.** `wrangler deploy` / `wrangler rollback` (last 100 versions) / `wrangler tail` cover the full loop. Docs have per-product `llms.txt` and `.md` pages. Official remote MCP servers (docs, bindings, builds, observability) exist; no formal GA label found. Free plan: 100k requests/day, 10 ms CPU, 64 MiB bundle. Paid $5: 10M requests, 30M CPU-ms included.

**Vercel.** Full Node runtime, 300 s on Hobby, `fra1` region selectable (single region on Hobby). `vercel rollback` on Hobby only goes back to the previous production deploy, runtime logs kept 1 h. Vercel MCP appears GA. Hobby is a hard cap and non-commercial only. Requires switching to `@astrojs/vercel` 11.x.

**Netlify.** Good CLI and docs, but no rollback command (UI or API only), functions default to US East and EU region requires Pro ($20), hard 60 s timeout, Free plan pauses all sites when credits run out.

**Fly.io.** Persistent Node container, ~$1–4/mo with auto-stop. No free tier for new orgs; Warsaw (`waw`) region deprecated — nearest is `fra`. Rollback = redeploy an old image. `fly mcp server` is experimental. Needs a Dockerfile and `@astrojs/node`.

**Railway.** ~$5/mo (Hobby incl. $5 usage), Amsterdam only EU region. Rollback is dashboard-only. Config-as-code (`railway.json`) is deprecated with a hard cutoff on 2026-12-01 — churn during the MVP window.

**Render.** Free tier spins down after 15 min with ~1 min cold start, which alone breaks the 60 s budget; Starter is $7/mo. CLI has no rollback; PR previews need Pro ($25).

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Perfect criteria score, $0 at this scale, zero migration work, commercial use allowed, deterministic deploy/rollback, and long streamed LLM calls cost almost no CPU. The weak spot is the 10 ms CPU cap on Free plus a non-Node runtime, both of which constrain how PDF parsing is done.

#### 2. Vercel

Full Node runtime and a 300 s limit make server-side PDF parsing trivial and free. Lost on: non-commercial-only Hobby plan, hard usage cap with no overage, single-step rollback, 1 h log retention, US default region, and the cost of migrating adapter, CI and docs. A detailed devil's-advocate check was run on Vercel during the decision (adapter migration cost, `fra1` region requirement, Fluid compute shared instances, Production/Preview env split) and did not change the outcome.

#### 3. Fly.io

A plain Node server with no CPU or duration traps, cheap with auto-stop. Lost on: no free tier, no Poland region, Dockerfile + adapter switch required, experimental MCP, manual image-based rollback.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10 ms CPU on the Free plan.** Server-side PDF text extraction (pdf.js / unpdf) will exceed it and return error 1102; heavy SSR pages with Supabase calls and React rendering may brush against it too.
2. **workerd is not Node.** PDF libraries that rely on `fs` (e.g. `pdf-parse`) or LLM SDKs with Node-only internals can pass locally in some setups and fail on deploy; `nodejs_compat` is partial.
3. **Mobile screen lock mid-generation.** A 60 s streamed request is cancelled when the phone sleeps or loses signal; proposals are lost but LLM tokens are already paid.
4. **Version preview URLs are public by default** on `workers.dev` and share the same secrets — i.e. production Supabase.
5. **Auto-provisioned KV sessions.** The adapter enables Astro sessions backed by a KV binding named `SESSION` unless `session: false`; Free KV allows only 1,000 writes/day.

### Pre-Mortem — How This Could Fail

The team stayed on the Free plan because "traffic is tiny". PDF extraction was put on the server with an npm library that worked in a quick local test. In production, every other PDF died with a CPU-limit error, and swapping libraries revealed the replacement used `fs` and did not run on workerd at all. Meanwhile on phones, generation silently broke whenever the screen locked, users retried, and AI costs doubled while no proposals were saved. Because half the generation sessions never finished, the acceptance-rate metric — the product's primary success criterion — was meaningless. Preview links shared for feedback wrote test flashcards into the production database. None of this was the platform's fault: the failures came from assuming Node semantics, ignoring the CPU limit, and treating a live stream as reliable on mobile. Extracting PDF text in the browser, upgrading to the $5 plan at the first 1102 error, keeping the screen awake during generation and using a separate Supabase project for previews would have prevented all of it.

### Unknown Unknowns

- **Pages is not an option.** `@astrojs/cloudflare` ≥ 13 supports only Workers + Static Assets; ignore Pages tutorials and the `cloudflare-pages` hint in `tech-stack.md`.
- **Worker name is still `10x-astro-starter`** in `wrangler.jsonc`. Renaming after the first deploy creates a new Worker with a new URL — rename to `lexio` before the first deploy.
- **`astro dev` already runs on workerd** (via `@cloudflare/vite-plugin` in adapter v14), so a separate `wrangler dev` is unnecessary. `Astro.locals.runtime` is removed — read secrets via `astro:env/server` (as the starter does) or `import { env } from "cloudflare:workers"`.
- **`wrangler preview` (per-branch preview environments) is marked "private beta" in the installed wrangler 4.131.1**; Cloudflare announced it publicly on 2026-09-22 but it needs wrangler ≥ 4.135. Plain version preview URLs (`wrangler versions upload`) are GA and sufficient for the MVP.
- **CPU-limit errors look like generic 5xx to users.** Enable `observability` (already on in `wrangler.jsonc`) and watch for exceeded-CPU events before deciding on the Paid plan.

## Operational Story

- **Preview deploys**: `npx wrangler versions upload --preview-alias <branch>` produces a version URL on `workers.dev` without promoting it; Workers Builds (Git integration) can post these as PR comments. URLs are public by default — do not share them widely, and point previews at a separate Supabase project if they will write data. Per-branch `wrangler preview` environments require wrangler ≥ 4.135 and are newly launched (treat as beta).
- **Secrets**: `SUPABASE_URL`, `SUPABASE_KEY` and the LLM API key live as Worker secrets (`npx wrangler secret put <NAME>`), read via `astro:env/server`. Locally they live in `.dev.vars` (git-ignored). CI deploy uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets. Rotation: `wrangler secret put` again (creates a new version), then revoke the old key at the provider.
- **Rollback**: `npx wrangler deployments list` → `npx wrangler rollback <version-id>`; takes seconds, covers the last 100 versions, blocked if a bound resource was deleted. Supabase migrations do **not** roll back with the Worker — write migrations to be backward-compatible with the previous version.
- **Approval**: a human approves production deploys (merge to `master` → CI deploy), secret rotation, rollback of production, and any destructive Supabase migration. An agent may unattended: build, lint, `astro check`, upload preview versions, read logs and deployment lists.
- **Logs**: `npx wrangler tail --format pretty` for live runtime logs (not available for preview version URLs); `npx wrangler deployments list` / `npx wrangler versions list` for history; GitHub Actions logs via `gh run view --log`; Cloudflare observability MCP server for structured queries.

## Risk Register

| Risk                                                                | Source                        | Likelihood | Impact | Mitigation                                                                                                                                     |
| ------------------------------------------------------------------- | ----------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-side PDF parsing exceeds 10 ms CPU on Free plan (error 1102) | Devil's advocate              | H          | H      | Extract PDF text in the browser (pdf.js) and send only text to the API; if server-side parsing is ever needed, switch to Workers Paid ($5/mo). |
| PDF / LLM library incompatible with workerd                         | Devil's advocate / Pre-mortem | M          | M      | In the first slice, spike the chosen LLM SDK (or plain `fetch`) on a deployed Worker, not only locally; prefer `fetch`-based SDKs.             |
| Generation lost when phone screen locks or signal drops mid-stream  | Devil's advocate / Pre-mortem | M          | M      | Use the Screen Wake Lock API during generation, show a clear retry, and cap generations per user to bound token spend.                         |
| Preview URLs public and wired to production Supabase                | Devil's advocate              | M          | M      | Use a separate Supabase project (or local Supabase) for previews; don't publish preview links.                                                 |
| KV-backed Astro sessions hit the 1,000 writes/day Free KV limit     | Unknown unknowns              | L          | M      | Set `session: false` in `astro.config.mjs` unless Astro sessions are needed — auth uses Supabase cookies.                                      |
| Renaming the Worker after first deploy changes its URL              | Unknown unknowns              | M          | L      | Rename `name` in `wrangler.jsonc` to `lexio` before the first deploy.                                                                          |
| Following outdated Pages / `locals.runtime` tutorials               | Unknown unknowns              | M          | L      | Use the Astro Cloudflare adapter docs for v14 and Cloudflare's `llms.txt`; read secrets via `astro:env/server`.                                |
| Worker Previews are newly launched and need newer wrangler          | Research finding              | L          | L      | Use GA version preview URLs for the MVP; upgrade wrangler to ≥ 4.135 only if per-branch environments are wanted.                               |
| Free-plan request cap (100k/day) hit by bot sign-ups                | Research finding              | L          | M      | Rate-limit sign-up and generation endpoints; upgrade to Paid if abuse appears.                                                                 |

## Getting Started

1. Rename the Worker before the first deploy: set `"name": "lexio"` in `wrangler.jsonc`, and add `session: false` to `astro.config.mjs` unless Astro sessions are needed.
2. Authenticate and set production secrets: `npx wrangler login`, then `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY` (and the LLM API key once added). For local dev, put the same keys in `.dev.vars`; `npm run dev` already runs on workerd, so no `wrangler dev` is needed.
3. First deploy: `npm run build && npx wrangler deploy`, then check the URL with `BASE_URL=https://lexio.<subdomain>.workers.dev npm run smoke`.
4. Wire CI: add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to GitHub Secrets and add a deploy step (`cloudflare/wrangler-action@v4`) on merge to `master`.
5. As the first feature slice, prove the generation path on the deployed Worker: browser-side PDF text extraction → streamed LLM call → proposals in < 60 s, while watching `npx wrangler tail` for CPU-limit errors.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
