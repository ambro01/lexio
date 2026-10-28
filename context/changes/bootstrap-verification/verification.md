---
bootstrapped_at: 2026-10-28T21:05:54Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: lexio
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

# Bootstrap verification — lexio

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: lexio
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack** (verbatim from hand-off):

A solo developer shipping a 3-week after-hours web MVP with email/password auth (including password reset), per-user data isolation and AI-generated flashcards needs an agent-friendly starter that covers auth, database and deploy from day one. Astro + React + TypeScript + Supabase + Cloudflare is the recommended default for a JS/TS web app and passes all four agent-friendly gates; bootstrapper confidence is first-class, so expect mostly-smooth scaffolding with occasional manual steps. The starter does not include an AI model integration or PDF text extraction (FR-002, FR-003, FR-006); the user chose to add both manually, ideally as the first slice of work, and to verify early that generating proposals from a ~10-page PDF fits within the 60-second target given the edge runtime's limits on long-running work. Payments, realtime and background jobs are out of scope. CI runs on GitHub Actions with auto-deploy on merge to main.

## Pre-scaffold verification

| Signal      | Value                                                     | Severity | Notes                                                                                   |
| ----------- | --------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| npm package | not run                                                   | —        | cmd_template starts with `git clone`; no npm CLI to check                               |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-09-12 | fresh    | from card.docs_url; queried via GitHub REST API (`gh` not installed); repo not archived |

**Populated-cwd guard**: the directory held an empty HTML5 Boilerplate template (`package.json` with webpack, `index.html`, `404.html`, `js/`, `css/`, `img/`, icons, `robots.txt`, `site.webmanifest`, `webpack.*.js`, `LICENSE.txt`, `.editorconfig`, `.gitattributes`, `.gitignore`). With the user's explicit approval these files were deleted before scaffolding, so the starter's `package.json` would not be sidelined as `package.json.scaffold`. Preserved: `context/`, `.claude/`, `.agents/`, `.idea/`, `lexio.iml`, `CLAUDE.md`, `.10x-cli.json`, `skills-lock.json`.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 21 top-level entries (30,832 files including `node_modules/`): `.env.example`, `.github/`, `.gitignore`, `.husky/`, `.nvmrc`, `.prettierrc.json`, `.vscode/`, `AGENTS.md`, `README.md`, `astro.config.mjs`, `components.json`, `eslint.config.js`, `node_modules/`, `package-lock.json`, `package.json`, `public/`, `scripts/`, `src/`, `supabase/`, `tsconfig.json`, `wrangler.jsonc`
**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold`
**.gitignore handling**: moved silently (absent in cwd after template removal)
**.bootstrap-scaffold cleanup**: deleted (cloned `.git/` removed before move-up)

**Install warnings**: `npm warn EBADENGINE` — `astro-eslint-parser@3.1.0` and `eslint-plugin-astro@3.1.0` require Node `^22.22.3 || ^24.16.0 || >=26.3.0`; local Node is v22.20.0. Install succeeded; linting may misbehave until Node is upgraded (the starter ships an `.nvmrc`).

## Post-scaffold audit

**Tool**: `npm audit --json` (exit code 1 — vulnerabilities present; informational only)
**Summary**: 0 CRITICAL, 11 HIGH, 2 MODERATE, 1 LOW
**Direct vs transitive**: 0/1/0/1 direct of total 0/11/2/1 (direct: `wrangler` HIGH, `astro` LOW). All findings report a fix available.

#### CRITICAL findings

None.

#### HIGH findings

- **wrangler** (direct) — range `4.16.0 - 4.148.0`; vulnerable via `miniflare`. Fix available.
- **@cloudflare/vite-plugin** — range `1.2.3 - 1.63.0`; via `miniflare`, `wrangler`. Fix available.
- **miniflare** — range `4.20250508.3 - 5.20261006.0-alpha`; via `sharp`, `undici`. Fix available.
- **sharp** — `<0.35.5`; 1241331 vulnerability in librsvg dependency (CVE-2026-96889). Fix available.
- **undici** — `7.0.0 - 7.30.0 || 8.0.0 - 8.12.1`; multiple advisories (1239933–1243484): DoS variants, response splitting, cross-user cookie/cache disclosure, TLS certificate validation bypass, SRI bypass. Fix available.
- **vite** — `8.3.0 - 8.3.2`; 1242626/1242655/1242662 launch-editor issues (incl. Windows-specific), 1242728 cross-origin script execution via custom middleware, 1242734/1242737 file exposure outside `server.fs.allow`. Fix available.
- **brace-expansion** — `<=1.1.20 || 4.0.0 - 5.0.11`; 1240100–1240111 CPU/stack-exhaustion DoS. Fix available.
- **devalue** — `<=5.9.2`; 1240870–1242362 serialization/CPU amplification/prototype issues. Fix available.
- **http-cache-semantics** — `<=4.2.0`; 1240991 max-stale handling can disclose cross-user cached responses. Fix available.
- **source-map-js** — `1.0.0 - 1.2.1`; 1241209 event-loop DoS. Fix available.
- **zod** — `<4.6.6`; 1243066 memory exhaustion on oversized constrained collections. Fix available.

#### MODERATE findings

- **fast-uri** — `3.0.0 - 3.1.8`; 1240091, 1243098, 1243101, 1243104, 1243107 normalization/spoofing issues. Fix available.
- **smol-toml** — `<=1.8.0`; 1241205 quadratic-time parse. Fix available.

#### LOW / INFO findings

- **astro** (direct) — `7.1.0 - 7.3.2`; 1242878 arbitrary CSS injection in View Transitions. Fix available.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | true                 |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
