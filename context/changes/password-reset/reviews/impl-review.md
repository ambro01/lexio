<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Password Reset

- **Plan**: context/changes/password-reset/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Success criteria were re-run on 2026-11-15 against HEAD e073dd2: `npm run lint` passed, `npx astro check` had 0 errors and 0 warnings, `npm test` passed 323 of 323, `npm run build` passed, and `npm run smoke` passed every step. All manual rows (1.6–1.7, 2.6–2.10, 3.3–3.4) were confirmed by the user in the implementation session.

## Findings

### F1 — update-password accepts any session, not only a recovery session

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/update-password.ts:15
- **Detail**: The endpoint (and the page at src/pages/auth/update-password.astro:12) only checks that `getUser()` returns a user. A normal signed-in session can POST a new password without knowing the old one. GoTrue doesn't stop it either, because `secure_password_change = false` (supabase/config.toml:211). In effect this ships an unlinked "change password without the old password" for every signed-in user, while the plan says signed-in users get no change-password (plan.md "What We're NOT Doing"). Anyone with access to a session (a shared unlocked device, a leaked cookie) can lock the owner out.
- **Fix A ⭐ Recommended**: In `confirm.ts`, after `verifyOtp` succeeds, set a short-lived httpOnly `pw_recovery` cookie (for example 15 minutes, path `/`). Require it on the page and the endpoint; without it, use the existing expired-link path. Clear it after a successful update.
  - Strength: Closes the gap at the app boundary with no Supabase dashboard dependency. The page and endpoint then match the plan's intent (reset-only).
  - Tradeoff: One more cookie and about 10 lines across 3 files. The smoke steps still pass, because anonymous requests already lack it.
  - Confidence: MED — the cookie is set on the redirect response the same way the session cookies are, but the cross-browser flow needs a manual re-check.
  - Blind spot: The cookie is not tied to the user id. A recovery started in one account and finished in another inside 15 minutes on the same browser would pass.
- **Fix B**: Accept the risk for the MVP and enable "Secure password change" in Supabase production (Authentication → Providers → Email), so GoTrue requires reauthentication for sessions older than 24 h.
  - Strength: No code change. It is a platform control.
  - Tradeoff: Leaves the gap open for sessions younger than 24 h, and diverges from local config.
  - Confidence: MED — this relies on GoTrue's "recent login" window, which a fresh recovery session satisfies.
  - Blind spot: Not verified how the reauthentication error surfaces through `updateUser` in this UI.
- **Decision**: FIXED via Fix B. The risk is accepted; enabling "Secure password change" in prod was added to deploy-plan.md §G as a human-run step.

### F2 — GET on /auth/confirm consumes the one-time token (link prefetchers)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/auth/confirm.ts:6
- **Detail**: `verifyOtp` runs on a plain GET. Mail security scanners that prefetch links (Outlook Safe Links, corporate gateways) use up the `token_hash`, so the user's real click lands on "invalid or expired". This is a known Supabase pitfall. Gmail does not prefetch, and the production test passed.
- **Fix A**: GET renders a small "Continue to reset your password" page whose button POSTs `token_hash`. `verifyOtp` runs only on POST.
  - Strength: Robust against any prefetcher. This is Supabase's documented mitigation.
  - Tradeoff: One more click for every user, a new page, and smoke steps change from GET to POST.
  - Confidence: HIGH — standard pattern.
  - Blind spot: None significant.
- **Fix B ⭐ Recommended**: Accept for the MVP and add a troubleshooting line to deploy-plan.md §G ("Outlook/corporate users may see 'expired' on first click — cause: link prefetch").
  - Strength: The target users (Polish learners) mostly use consumer mailboxes. The cost is zero, and the gap is documented.
  - Tradeoff: Some corporate or Outlook users can't reset without a workaround.
  - Confidence: MED — the user mix is assumed, not measured.
  - Blind spot: No data on the users' email providers.
- **Decision**: FIXED via Fix B. Accepted for the MVP; a troubleshooting note was added to deploy-plan.md §G.

### F3 — Other sessions stay alive after a reset

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/update-password.ts:24
- **Detail**: `updateUser({ password })` does not revoke other refresh tokens. A reset is the usual response to a compromised account, but an attacker's existing session survives it.
- **Fix**: After a successful update, call `await supabase.auth.signOut({ scope: "others" })` before redirecting.
- **Decision**: FIXED. `signOut({ scope: "others" })` was added after a successful `updateUser`; the current session is kept.

### F4 — /auth/confirm hides misconfiguration and logs nothing

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/auth/confirm.ts:15
- **Detail**: This case isn't in the plan. An unconfigured Supabase is shown as "This reset link is invalid or has expired". Every `verifyOtp` error is also swallowed without a log, unlike signin, which shows "Supabase is not configured". A config or provider problem in production would look like expired links.
- **Fix**: Redirect an unconfigured Supabase with `?error=Supabase is not configured` (as signin does), and `console.error` the `verifyOtp` error before the generic redirect.
- **Decision**: FIXED (adjusted to the repo's logging pattern). An unconfigured Supabase now redirects with "Supabase is not configured". A `verifyOtp` failure logs one structured `recovery_verify_failed` line (code and status only) before the generic redirect.

### F5 — `?error=` text can be spoofed in the trusted error box

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/auth/forgot-password.astro:5
- **Detail**: Any attacker-written `?error=` text is rendered in the red ServerError box. It is escaped, so it is not XSS, but it is usable for phishing ("call support at…"). update-password.astro:6, signin and signup have the same issue, so it is an existing project-wide pattern rather than new to this change.
- **Fix**: Skip for this change. If it should be addressed, record it as a lesson (error codes mapped to fixed messages on all auth pages) and fix it in a separate change.
- **Decision**: SKIPPED

### F6 — Raw GoTrue error messages shown to users

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/forgot-password.ts:16
- **Detail**: Messages like "For security purposes, you can only request this after N seconds" or "email rate limit exceeded" reach the user as-is (also in update-password.ts:24). The plan wants delivery errors visible on purpose, they don't reveal whether an account exists, and the behavior matches signin and signup.
- **Fix**: Leave as is, or map only the rate-limit error to a friendly fixed message.
- **Decision**: SKIPPED
