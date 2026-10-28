---
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
---

## Why this stack

A solo developer shipping a 3-week after-hours web MVP with email/password auth (including password reset), per-user data isolation and AI-generated flashcards needs an agent-friendly starter that covers auth, database and deploy from day one. Astro + React + TypeScript + Supabase + Cloudflare is the recommended default for a JS/TS web app and passes all four agent-friendly gates; bootstrapper confidence is first-class, so expect mostly-smooth scaffolding with occasional manual steps. The starter does not include an AI model integration or PDF text extraction (FR-002, FR-003, FR-006); the user chose to add both manually, ideally as the first slice of work, and to verify early that generating proposals from a ~10-page PDF fits within the 60-second target given the edge runtime's limits on long-running work. Payments, realtime and background jobs are out of scope. CI runs on GitHub Actions with auto-deploy on merge to main.
