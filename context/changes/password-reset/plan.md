# Password Reset Implementation Plan

## Overview

Add an emailed "forgot password" flow on top of the existing Supabase email/password auth, completing FR-001 (roadmap S-08). The user asks for a reset email on a new `/auth/forgot-password` page. The email links to a server-side `/auth/confirm` route that verifies a `token_hash` and starts a recovery session. The user then sets a new password on `/auth/update-password` and lands on `/dashboard`, still signed in. In production, email goes through a custom SMTP provider set up in the Supabase dashboard.

## Current State Analysis

- Auth has sign-up, sign-in, sign-out and route protection only. The roadmap notes "no password reset yet (S-08)" (`context/foundation/roadmap.md:76`).
- Every auth action is a plain form POST to `src/pages/api/auth/*.ts`. The endpoint redirects back to the page with `?error=<message>` on failure (`src/pages/api/auth/signin.ts:13-17`). The page reads `error` from the URL and passes it to a React island form (`src/pages/auth/signin.astro:5,14`).
- Forms are built from shared parts in `src/components/auth/`: `FormField`, `PasswordToggle`, `SubmitButton` (pending state through `useFormStatus`) and `ServerError`. Client-side validation calls `e.preventDefault()` only when the form is invalid (`src/components/auth/SignInForm.tsx:36-40`).
- `createClient` (`src/lib/supabase.ts:6-22`) is an `@supabase/ssr` server client that writes session cookies through `context.cookies`. Its default PKCE flow keeps the code verifier in a cookie, so a `?code=` link only works in the browser that requested it.
- The middleware sets `locals.user` on every request and redirects anonymous users away from `PROTECTED_ROUTES` (`src/middleware.ts:4-27`).
- The minimum password length is 6. It's a local const in `SignUpForm.tsx:8`, matching `minimum_password_length = 6` in `supabase/config.toml:175`.
- Local Supabase: `site_url = "http://127.0.0.1:3000"` (`supabase/config.toml:154`), but the app runs on `http://localhost:4321`. Inbucket/Mailpit is on port 54324 (`config.toml:99-102`). No recovery email template is configured yet (`config.toml:229-233`).
- Production Supabase has Site URL `https://lexio.rafalambro.workers.dev` (`context/deployment/deploy-plan.md:36`). SMTP isn't configured, so the built-in sender is used: rate-limited, and only delivers to the org's team members.
- CI smoke starts local Supabase with Mailpit excluded (`.github/workflows/*.yml:44`). `scripts/smoke.mjs:38-69` is a list of `[name, request, {status, location}]` steps.

## Desired End State

A user who forgot their password clicks "Forgot password?" on `/auth/signin`, enters their email and sees "check your email". They open the emailed link (on any device), set a new password and land on `/dashboard`, signed in, with a "password updated" notice. Bad or expired links and anonymous visits to the set-password page show a clear message with a way to request a new link. In production, reset emails reach real users through custom SMTP.

How to check it: the new smoke steps pass, lint, `astro check`, tests and build are green, and the manual Mailpit end-to-end check in Phase 3 succeeds.

### Key Discoveries:

- The endpoint redirect pattern, `?error=` → `ServerError`, is the convention to follow (`src/pages/api/auth/signin.ts:13-17`, `src/components/auth/ServerError.tsx`).
- The server client's `verifyOtp` sets the session cookies through `setAll` (`src/lib/supabase.ts:15-19`), so the confirm route needs no extra cookie handling.
- `{{ .SiteURL }}` in the email template uses Site URL. Production's Site URL is already correct, so no Redirect URLs entry is needed and `resetPasswordForEmail` doesn't pass `redirectTo`.
- The smoke job runs without Mailpit. GoTrue sends no email for an unknown address and still returns success, so a smoke step with an unknown email works there.

## What We're NOT Doing

- No "change password" for signed-in users on `/profile`. The forgot flow covers it.
- No PKCE `?code=` callback or `exchangeCodeForSession` route.
- No smoke step that reads Mailpit or follows the real link. CI keeps excluding Mailpit, and the full flow is checked by hand.
- No custom templates for other emails (sign-up confirmation, invite, email change).
- No Polish translation of the auth pages. The new pages match the existing English auth UI.
- No signing out after a reset. The recovery session is kept.
- No database migration and no change to `database.types.ts`.

## Implementation Approach

Follow the existing auth shape exactly: an Astro page hosting a React island form, posting to an `/api/auth/*` endpoint that redirects back with `?sent=1` / `?error=`. The link uses the `token_hash` + `verifyOtp` pattern Supabase recommends for SSR, so it works across devices. Supabase stays the only source of truth for tokens and sessions: the app never stores or inspects reset tokens. Production email delivery is a configuration step, not code.

## Critical Implementation Details

- **Local config needs a restart**: `supabase/config.toml` changes (site_url, recovery template) only apply after `npx supabase stop && npx supabase start`. The `content_path` examples in the file disagree about the base folder (`./supabase/templates/…` vs `./templates/…`). Confirm the template is picked up by checking the email body in Mailpit, not by assuming.
- **Don't protect `/auth/update-password` in middleware**: adding it to `PROTECTED_ROUTES` would send an expired-link user to sign-in without saying why. The page handles a missing `locals.user` itself.
- **No account enumeration**: the forgot-password endpoint shows the same "check your email" result for known and unknown addresses. Supabase doesn't distinguish them, and the endpoint must not add its own lookup. Real Supabase errors (rate limit, send failure) still go back as `?error=`, so delivery problems stay visible.

## Phase 1: Request a reset

### Overview

A user can request a reset email from a new page linked from sign-in. Locally, the email arrives in Mailpit with a `token_hash` link to `/auth/confirm`.

### Changes Required:

#### 1. Local Supabase auth config and recovery template

**File**: `supabase/config.toml`, `supabase/templates/recovery.html` (new)

**Intent**: Point local Site URL at the dev server and switch the recovery email to the token_hash link format, so local emails link to a route that exists.

**Contract**: `site_url = "http://localhost:4321"`. `additional_redirect_urls` includes `http://localhost:4321` and `http://127.0.0.1:4321`. A `[auth.email.template.recovery]` block with a subject ("Reset your Lexio password") and `content_path` pointing at the new template. The template's link is exactly:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

#### 2. Forgot-password endpoint

**File**: `src/pages/api/auth/forgot-password.ts` (new)

**Intent**: Ask Supabase to send the recovery email, then send the user to the "check your email" state.

**Contract**: `POST` with form field `email`. Unconfigured Supabase → `302 /auth/forgot-password?error=Supabase is not configured` (same as signin). Calls `supabase.auth.resetPasswordForEmail(email)` with no `redirectTo`. On error → `302 /auth/forgot-password?error=<message>`. On success → `302 /auth/forgot-password?sent=1`.

#### 3. Forgot-password page and form

**File**: `src/pages/auth/forgot-password.astro` (new), `src/components/auth/ForgotPasswordForm.tsx` (new)

**Intent**: The page where the user enters their email. With `sent=1` it shows a confirmation instead of the form.

**Contract**: The page reads `error` and `sent` from the URL and uses the same card layout as `signin.astro`. With `sent=1`: a "Check your email" message ("If an account exists for that address, we've sent a reset link") and a link back to sign-in. Otherwise: `ForgotPasswordForm` (email field with the same validation as `SignInForm`, `ServerError`, `SubmitButton` "Send reset link") posting to `/api/auth/forgot-password`, plus a "Back to sign in" link.

#### 4. Entry point on sign-in

**File**: `src/pages/auth/signin.astro`

**Intent**: Make the flow discoverable.

**Contract**: A "Forgot password?" link to `/auth/forgot-password` near the password field or the submit button.

#### 5. Smoke step

**File**: `scripts/smoke.mjs`

**Intent**: Guard the request endpoint in CI.

**Contract**: A new step, "forgot-password accepts unknown email": `POST /api/auth/forgot-password` with a random unknown email → `{ status: 302, location: "/auth/forgot-password?sent=1" }`. Also a step for `GET /auth/forgot-password` → 200.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Unit tests pass: `npm test`
- Build succeeds: `npm run build`
- Smoke passes, including the new forgot-password steps: `BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- "Forgot password?" on `/auth/signin` opens the forgot-password page, and submitting a registered email shows the "check your email" state
- The recovery email in local Mailpit (`http://localhost:54324`) contains a link of the form `http://localhost:4321/auth/confirm?token_hash=…&type=recovery`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Confirm and set the new password

### Overview

The emailed link starts a recovery session, the user sets a new password, and lands on the dashboard still signed in.

### Changes Required:

#### 1. Confirm route

**File**: `src/pages/auth/confirm.ts` (new, Astro endpoint)

**Intent**: Verify the emailed token server-side and turn it into a session, so the link works on any device.

**Contract**: `GET` with `token_hash` and `type`. Accepts only `type=recovery`. Missing params, another type, or a `verifyOtp` error → `302 /auth/forgot-password?error=<"This reset link is invalid or has expired. Request a new one.">`. Calls `supabase.auth.verifyOtp({ type: "recovery", token_hash })`. On success → `302 /auth/update-password`.

#### 2. Shared password rule

**File**: `src/lib/auth.ts` (new), `src/components/auth/SignUpForm.tsx`

**Intent**: One minimum-length constant for both sign-up and set-password forms.

**Contract**: `export const MIN_PASSWORD_LENGTH = 6`, imported by `SignUpForm` in place of its local const. Behavior unchanged.

#### 3. Update-password endpoint

**File**: `src/pages/api/auth/update-password.ts` (new)

**Intent**: Save the new password for the user's current (recovery) session.

**Contract**: `POST` with form field `password`. Unconfigured Supabase → `302 /auth/update-password?error=…`. No authenticated user (`supabase.auth.getUser()` returns none) → `302 /auth/forgot-password?error=<"Your reset session has expired. Request a new link.">`. Calls `supabase.auth.updateUser({ password })`. On error (e.g. weak or same password) → `302 /auth/update-password?error=<message>`. On success → `302 /dashboard?password_updated=1`.

#### 4. Update-password page and form

**File**: `src/pages/auth/update-password.astro` (new), `src/components/auth/UpdatePasswordForm.tsx` (new)

**Intent**: The page where the user picks a new password. Anonymous visitors get a clear dead-end message instead of a form that can't work.

**Contract**: When `Astro.locals.user` is missing, the page shows "This reset link is invalid or has expired" and a link to `/auth/forgot-password`. Otherwise it shows `UpdatePasswordForm`: new-password and confirm fields with `PasswordToggle`, the same validation as `SignUpForm` (required, `MIN_PASSWORD_LENGTH`, must match), `ServerError` from `?error=`, and `SubmitButton` "Set new password", posting to `/api/auth/update-password`. The page isn't added to `PROTECTED_ROUTES`.

#### 5. Success notice on the dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Confirm the change after the redirect.

**Contract**: When `password_updated=1` is in the URL, a short success line ("Your password has been updated.") appears above the welcome text. Without the param, the dashboard is unchanged.

#### 6. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Guard the rejection paths that run without email in CI.

**Contract**: New steps:

- "confirm rejects bad token": `GET /auth/confirm?token_hash=bogus&type=recovery` → `{ status: 302, location: "/auth/forgot-password?error=" }`
- "confirm rejects non-recovery type": `GET /auth/confirm?token_hash=bogus&type=signup` → same
- "update-password rejects anonymous user": `POST /api/auth/update-password` with a password, before signup or after signout → `{ status: 302, location: "/auth/forgot-password?error=" }`
- "update-password page renders for anonymous user": `GET /auth/update-password` → 200

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Unit tests pass: `npm test`
- Build succeeds: `npm run build`
- Smoke passes, including the new confirm and update-password steps: `BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- Clicking the Mailpit link opens `/auth/update-password`. Setting a new password lands on `/dashboard` with the success notice, still signed in
- After signing out, the old password is rejected and the new one works on `/auth/signin`
- Reusing the same link a second time shows the invalid/expired message on `/auth/forgot-password`
- Opening `/auth/update-password` in a private window shows the expired-link message with a link to request a new one
- Sign-up still enforces the 6-character minimum (shared constant refactor)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Production rollout and docs

### Overview

Production can deliver reset emails to real users, and the docs describe the new routes and the dashboard steps.

### Changes Required:

#### 1. Deploy plan: Supabase dashboard steps

**File**: `context/deployment/deploy-plan.md`

**Intent**: Record the manual, human-run production configuration that the feature depends on.

**Contract**: A new "Password reset" checklist section:

- Set up custom SMTP in Supabase (Authentication → Emails → SMTP Settings) with a chosen provider (e.g. Resend or Brevo free tier), including the sender domain/DNS verification at the provider.
- Set the "Reset password" email template body to the same `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` link as `supabase/templates/recovery.html`.
- Raise the email rate limit (Authentication → Rate Limits) to fit expected traffic.
- After deploy, run a production check: request a reset for a real inbox and complete the flow.

All items are human-run. The agent doesn't set up the provider.

#### 2. README auth routes

**File**: `README.md`

**Intent**: Keep the route table and auth docs current.

**Contract**: Rows in the Auth routes table for `/auth/forgot-password` (request a reset email), `/auth/confirm` (verifies the emailed reset link) and `/auth/update-password` (set a new password after following the link). A sentence noting that local reset emails show up in Mailpit at `http://localhost:54324` and that production needs custom SMTP (see deploy plan).

### Success Criteria:

#### Automated Verification:

- Format/lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Full local end-to-end flow done once more on a fresh `npx supabase db reset` stack: request → Mailpit email → confirm → new password → sign in with it
- Production: custom SMTP and recovery template configured in the Supabase dashboard, and a reset email reaches a real non-team inbox and completes the flow on `https://lexio.rafalambro.workers.dev`

**Implementation Note**: The production items are done by the human after the code is deployed. The agent marks only the automated rows.

---

## Testing Strategy

### Unit Tests:

- None new. The logic is thin glue over Supabase auth calls with no pure helpers worth isolating. The existing `npm test` suite must stay green after the `MIN_PASSWORD_LENGTH` refactor.

### Integration Tests:

- Smoke (CI, no Mailpit): the forgot-password page renders, the request with an unknown email redirects to `?sent=1`, confirm rejects a bad token and a non-recovery type, and update-password rejects an anonymous user and renders the expired message.

### Manual Testing Steps:

1. Sign up locally, sign out, click "Forgot password?" and submit the email
2. Open Mailpit (`http://localhost:54324`), check that the link points at `localhost:4321/auth/confirm?token_hash=…&type=recovery`, and click it
3. Set a new password (try a mismatched confirm and a 5-character password first), land on `/dashboard` with the notice
4. Sign out, check that the old password fails and the new one works
5. Click the same email link again and see the invalid/expired message
6. Open the email link on a different browser than the one that requested it and see that it still works (cross-device)

## Performance Considerations

None. Each request is one Supabase auth call, well inside the Workers CPU budget.

## Migration Notes

No data migration. Local developers must restart Supabase (`npx supabase stop && npx supabase start`) to pick up the `config.toml` changes. Production needs the dashboard steps in Phase 3, which can be done before or after the code deploy. Before SMTP is set up, emails only reach team-member addresses.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-08, Change ID `password-reset`)
- PRD: `context/foundation/prd.md:70` (FR-001)
- Pattern to follow: `src/pages/api/auth/signin.ts`, `src/pages/auth/signin.astro`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`
- Server client: `src/lib/supabase.ts`
- Smoke script: `scripts/smoke.mjs:38-69`
- Production auth config: `context/deployment/deploy-plan.md:36`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Request a reset

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Type check passes: `npx astro check`
- [x] 1.3 Unit tests pass: `npm test`
- [x] 1.4 Build succeeds: `npm run build`
- [x] 1.5 Smoke passes, including the new forgot-password steps: `BASE_URL=http://localhost:4321 npm run smoke`

#### Manual

- [x] 1.6 "Forgot password?" on `/auth/signin` opens the forgot-password page, and submitting a registered email shows the "check your email" state
- [x] 1.7 The recovery email in local Mailpit (`http://localhost:54324`) contains a link of the form `http://localhost:4321/auth/confirm?token_hash=…&type=recovery`

### Phase 2: Confirm and set the new password

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Type check passes: `npx astro check`
- [ ] 2.3 Unit tests pass: `npm test`
- [ ] 2.4 Build succeeds: `npm run build`
- [ ] 2.5 Smoke passes, including the new confirm and update-password steps: `BASE_URL=http://localhost:4321 npm run smoke`

#### Manual

- [ ] 2.6 Clicking the Mailpit link opens `/auth/update-password`. Setting a new password lands on `/dashboard` with the success notice, still signed in
- [ ] 2.7 After signing out, the old password is rejected and the new one works on `/auth/signin`
- [ ] 2.8 Reusing the same link a second time shows the invalid/expired message on `/auth/forgot-password`
- [ ] 2.9 Opening `/auth/update-password` in a private window shows the expired-link message with a link to request a new one
- [ ] 2.10 Sign-up still enforces the 6-character minimum (shared constant refactor)

### Phase 3: Production rollout and docs

#### Automated

- [ ] 3.1 Format/lint passes: `npm run lint`
- [ ] 3.2 Build succeeds: `npm run build`

#### Manual

- [ ] 3.3 Full local end-to-end flow done once more on a fresh `npx supabase db reset` stack: request → Mailpit email → confirm → new password → sign in with it
- [ ] 3.4 Production: custom SMTP and recovery template configured in the Supabase dashboard, and a reset email reaches a real non-team inbox and completes the flow on `https://lexio.rafalambro.workers.dev`
