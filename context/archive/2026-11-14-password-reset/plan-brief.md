# Password Reset — Plan Brief

> Full plan: `context/changes/password-reset/plan.md`

## What & Why

Let a user who forgot their password get a reset email and set a new password. This completes FR-001 (roadmap S-08). Sign-up is open, so without reset, a forgotten password means a lost account and lost flashcards.

## Starting Point

Supabase email/password auth exists: sign-up, sign-in, sign-out and middleware route protection. Each action is a form POST to `src/pages/api/auth/*.ts` that redirects back with `?error=`. There's no reset flow, no recovery email template, and production email uses Supabase's built-in sender, which only reaches team members' addresses.

## Desired End State

"Forgot password?" on sign-in → enter email → "check your email". The emailed link works on any device, opens a set-password page, and saving lands the user on `/dashboard`, still signed in, with a success notice. Invalid or expired links say so and point to requesting a new one. In production, emails reach real users through custom SMTP.

## Key Decisions Made

| Decision                  | Choice                                                           | Why (1 sentence)                                                                                 |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Production email delivery | Custom SMTP set up in the Supabase dashboard                     | The built-in sender only reaches team-member addresses, so reset would be broken for real users. |
| Link mechanism            | `token_hash` + `verifyOtp` on `/auth/confirm`                    | Works when the email is opened on another device, unlike the PKCE `?code=` cookie flow.          |
| After the reset           | Keep the recovery session, go to `/dashboard?password_updated=1` | Fewest steps back into the app.                                                                  |
| Scope                     | Forgot flow only, no change-password on `/profile`               | Matches S-08/FR-001 exactly and keeps the change small.                                          |
| Testing                   | Smoke steps without email + manual Mailpit e2e                   | Fits the dependency-free smoke script, and CI keeps excluding Mailpit.                           |
| Enumeration               | Same "check your email" result for known and unknown emails      | Doesn't reveal which addresses have accounts.                                                    |
| Link URL base             | `{{ .SiteURL }}` in the template, no `redirectTo`                | Production Site URL is already correct, so no Redirect URLs change.                              |

## Scope

**In scope:**

- `/auth/forgot-password` page, form and endpoint, plus a "Forgot password?" link on sign-in
- `/auth/confirm` token verification route
- `/auth/update-password` page, form and endpoint, plus a dashboard success notice
- Local `supabase/config.toml` (site_url → `localhost:4321`) and a recovery email template
- Smoke steps, a shared `MIN_PASSWORD_LENGTH`, README and deploy-plan docs

**Out of scope:**

- Change-password for signed-in users; PKCE `?code=` callback
- Smoke test that reads Mailpit; other email templates; Polish translation of auth UI
- Database migrations

## Architecture / Approach

Same shape as the existing auth: Astro page + React island form → `POST /api/auth/*` → redirect with `?sent=1`/`?error=`. Supabase owns the tokens and sessions. `resetPasswordForEmail` sends the email, the template links to `/auth/confirm?token_hash=…&type=recovery`, `verifyOtp` sets the session cookies through the existing SSR client, and `updateUser({ password })` saves the new password. Production email delivery is dashboard configuration, not code.

## Phases at a Glance

| Phase                               | What it delivers                                                 | Key risk                                                               |
| ----------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Request a reset                  | Forgot-password page/endpoint, recovery template, sign-in link   | Template `content_path` / site_url only apply after a Supabase restart |
| 2. Confirm and set the new password | `/auth/confirm`, update-password page/endpoint, dashboard notice | Expired-link and anonymous paths must give a clear way out             |
| 3. Production rollout and docs      | SMTP + template + rate-limit steps, README routes                | Provider/DNS setup is outside the repo and human-run                   |

**Prerequisites:** Local Supabase running (Docker); for Phase 3, access to the Supabase dashboard and an SMTP provider account.
**Estimated effort:** ~1–2 sessions across 3 phases, plus the human-run production setup.

## Open Risks & Assumptions

- Assumes GoTrue returns success for an unknown email without trying to send. The CI smoke step relies on this because Mailpit is excluded there.
- Until custom SMTP is set up, production reset emails only reach team-member addresses.
- Recovery links expire after `otp_expiry` (1 h locally) and work only once. Users who wait too long must request a new one.

## Success Criteria (Summary)

- A registered user can reset a forgotten password from the sign-in page and sign in with the new one
- The emailed link works on a different device or browser than the one that requested it
- Bad, reused or expired links and anonymous visits end in a clear "request a new link" message
