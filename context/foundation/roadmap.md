---
project: Lexio
version: 1
status: draft
created: 2026-11-03
updated: 2026-11-11
prd_version: 4
main_goal: speed
top_blocker: time
milestone_id: lesson-to-review-mvp
milestone_seq: 1
milestone_status: open
---

# Roadmap: Lexio

> Derived from `context/foundation/prd.md` (v4) + auto-researched codebase baseline.
> Edit-in-place; the next milestone continues this file. Archive only when an independent roadmap replaces it.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Lesson-to-review MVP** — Status: open

- **Intent:** A signed-in learner can turn lesson material (pasted text or PDF) into reviewed flashcards with AI help and practise them with spaced repetition — the full MVP loop from the PRD, shipped before the hard deadline.
- **Source materials:** `context/foundation/prd.md` (v4)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** US-01; must-have FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-010, FR-011, FR-013, FR-014, FR-015, FR-016.

## Vision recap

A Polish learner taking 1–2 English lessons a week copies new words from lesson PDFs into a notebook they rarely open, so the same words keep coming back as if new. Lexio generates English–Polish flashcard proposals from lesson PDFs or pasted text with AI, lets the learner review every proposal before it enters the collection, and schedules reviews with an existing spaced-repetition method (a schedule that shows weaker cards more often).

## North star

**S-01: User can paste lesson text, get AI flashcard proposals, review them and accept the set into their collection** — this is the flow the primary success criterion (AI content quality ≥ 75%) is measured on, so it ships first; under the `speed` goal it is also the shortest path to a usable product.

> "North star" here means the smallest end-to-end slice whose successful delivery proves the core product hypothesis — that AI proposals from lesson material are good enough to accept. It is placed as early as its prerequisites allow, because everything else only matters if this works.

## At a glance

| ID   | Change ID                   | Outcome (user can …)                                                               | Prerequisites | PRD refs                        | Status      |
| ---- | --------------------------- | ---------------------------------------------------------------------------------- | ------------- | ------------------------------- | ----------- |
| F-01 | openrouter-generation-spike | (foundation) deployed app calls the AI model via OpenRouter within the 60 s budget | —             | NFR (< 60 s, progress)          | done        |
| F-02 | flashcard-data-contract     | (foundation) per-user flashcard + tag storage with isolation and one-word-per-user | —             | NFR (isolation), Access Control | done        |
| S-01 | paste-text-generation       | paste lesson text, review AI proposals, accept the set into the collection         | F-01, F-02    | US-01, FR-003, FR-004, FR-005   | done        |
| S-02 | pdf-lesson-generation       | upload a lesson PDF and get the same proposal review                               | S-01          | US-01, FR-002                   | done        |
| S-03 | cefr-too-easy-grouping      | set CEFR level and AI model in profile; bulk-reject "too easy" ones                | S-01          | US-01, FR-014, FR-016           | done        |
| S-04 | manual-word-ai-fill         | enter a word with optional context and get an AI-filled flashcard to review        | F-01, F-02    | FR-006                          | in-progress |
| S-05 | collection-edit-and-tags    | browse the collection, edit, delete and tag flashcards with tag suggestions        | F-02, S-01    | FR-007, FR-008                  | proposed    |
| S-06 | spaced-review-session       | run a review by tag or general, rate cards and mark them "Opanowane"               | F-02, S-01    | FR-010, FR-011                  | proposed    |
| S-07 | acceptance-rate-stats       | see the AI content-quality rate (unchanged / corrected / rejected as "Błędne")     | S-01          | FR-013                          | proposed    |
| S-08 | password-reset              | reset a forgotten password via email                                               | —             | FR-001                          | ready       |
| S-09 | skip-known-words            | never see again words they rejected as known or too easy                           | S-01          | US-01, FR-015                   | proposed    |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme               | Chain                                               | Note                                                                                            |
| ------ | ------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A      | Lesson → proposals  | `F-01` → `S-01` → `S-02` → `S-03` → `S-09` → `S-07` | Critical path for the `speed` goal; joins Stream B at `S-01` (needs `F-02`).                    |
| B      | Collection & review | `F-02` → `S-04` → `S-05` → `S-06`                   | `S-04` also needs `F-01`; `S-05` and `S-06` join Stream A at `S-01` (they need cards to exist). |
| C      | Account             | `S-08`                                              | Standalone; can run in parallel with anything — useful filler given the `time` constraint.      |

## Baseline

What's already in place in the codebase as of `2026-11-03` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro + React + Tailwind/shadcn UI (`src/components`, `src/pages`, `src/layouts/Layout.astro`).
- **Backend / API:** partial — only auth routes (`src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts`); no domain API.
- **Data:** partial — Supabase client wired (`src/lib/supabase.ts`), no migrations or flashcard schema.
- **Auth:** partial — sign-up, sign-in, sign-out and route protection middleware (`src/middleware.ts`, protects `/dashboard`); no password reset (FR-001).
- **Deploy / infra:** present — Cloudflare Workers with Workers Builds auto-deploy from `master` (`wrangler.jsonc`, `context/deployment/deploy-plan.md`); CI quality gate in `.github/workflows/ci.yml`.
- **Observability:** partial — Workers runtime logs only (`observability.enabled` in `wrangler.jsonc`); no error tracking.
- **AI integration:** absent — planned via OpenRouter for generating flashcard proposals (user-confirmed); no code yet.

## Foundations

### F-01: AI generation path proven on the deployed app

- **Outcome:** (foundation) the deployed app sends lesson-sized text (up to 2,000 words) to an AI model through OpenRouter and returns structured output within 60 s with visible progress; the API key is a server-side secret.
- **Change ID:** openrouter-generation-spike
- **PRD refs:** NFR "proposals ready in < 60 s, with continuous visible progress"; NFR input size limit (2,000 words)
- **Unlocks:** S-01, S-04; reduces the risk-register unknown "LLM library incompatible with the edge runtime / long requests on the deployed Worker".
- **Prerequisites:** —
- **Parallel with:** F-02, S-08
- **Blockers:** —
- **Unknowns:** — (resolved 2026-11-03: three models in app config — two of the planned five failed the production measurement and were dropped; default `anthropic/claude-haiku-5.5` chosen from the measurements in this change.)
- **Risk:** Sequenced first because a 60 s generation on the edge runtime is the riskiest technical assumption; must stay a thin proven path, not the full proposal flow (that lives in S-01).
- **Status:** done

### F-02: Minimal per-user flashcard data contract

- **Outcome:** (foundation) flashcards and tags are stored per user, one flashcard per word per user, with many tags per flashcard, and no user can read another user's data.
- **Change ID:** flashcard-data-contract
- **PRD refs:** NFR "a user never sees another user's flashcards, tags or statistics"; Access Control; FR-005 (one word, many tags)
- **Unlocks:** S-01, S-04, S-05, S-06
- **Prerequisites:** —
- **Parallel with:** F-01, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Isolation must exist before any user data is written; scope stays at flashcard + tag only — review scheduling state and acceptance records are added by S-06 and S-01 when they need them.
- **Status:** done

## Slices

### S-01: Paste text → AI proposals → reviewed set in the collection

- **Outcome:** user can paste lesson text with a lesson tag name, see AI proposals (word, Polish translation, additional meanings, example sentence), edit each, reject it as "Znam / nieprzydatne" or as "Błędne" (the reason is recorded for statistics), and accept the set so accepted flashcards land in the collection with the lesson tag — a word already in the collection gets the extra tag instead of a duplicate.
- **Change ID:** paste-text-generation
- **PRD refs:** US-01, FR-003, FR-004, FR-005
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-04, S-08
- **Blockers:** —
- **Unknowns:** — (input limit resolved 2026-11-03: 2,000 words; larger input is rejected with a clear message.)
- **Risk:** North star — delivered first because it proves the acceptance-rate hypothesis; nothing may be saved before the set is accepted (guardrail).
- **Status:** done

### S-02: Generate proposals from a lesson PDF

- **Outcome:** user can upload a lesson PDF with a text layer and get the same proposal review as S-01; the PDF is not retained afterwards and oversized input is rejected with a clear message.
- **Change ID:** pdf-lesson-generation
- **PRD refs:** US-01, FR-002
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-05, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Comes after S-01 so PDF text extraction is the only new risk; the risk register flags server-side PDF parsing as likely to exceed the free-plan CPU limit.
- **Status:** done

### S-03: CEFR level and "too easy" grouping

- **Outcome:** user can set their CEFR level and their AI model (one of the three configured in F-01) in their profile and see proposals below that level in a separate collapsed "too easy" group that they can reject in one action — bulk-rejected proposals are recorded automatically with the reason "Za łatwe".
- **Change ID:** cefr-too-easy-grouping
- **PRD refs:** US-01, FR-014, FR-016
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04, S-05, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Built on top of the S-01 review screen; CEFR level is an AI estimate, so proposals are grouped, never hidden. Bulk rejection reuses the same rejection record as S-01, with the reason "Za łatwe" — one code path for every rejection.
- **Status:** done

### S-04: Manual word with AI fill

- **Outcome:** user can enter a word or phrasal verb with an optional context sentence and get an AI-filled Polish translation (matching the context), additional meanings and an example sentence to review before saving.
- **Change ID:** manual-word-ai-fill
- **PRD refs:** FR-006
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02, S-03, S-05, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Independent of the lesson flow, so it can be built alongside S-01; must reuse the same one-word-per-user rule as S-01.
- **Status:** in-progress

### S-05: Manage the collection and tags

- **Outcome:** user can browse their flashcards, edit and delete them, and add tags with suggestions of existing tags (a "set" is just a tag); editing does not change learning progress.
- **Change ID:** collection-edit-and-tags
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** F-02, S-01
- **Parallel with:** S-02, S-03, S-04, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Needs cards from S-01 to be meaningful; search/filter by tag (FR-009) is parked, so keep the list simple.
- **Status:** proposed

### S-06: Spaced-repetition review session

- **Outcome:** user can start a review by tag or a general review with a card limit, rate each card "Nie pamiętam", "Trudne" or "Łatwe", and mark a card "Opanowane" (excluded from general review, reversible); card selection and order follow an existing spaced-repetition method.
- **Change ID:** spaced-review-session
- **PRD refs:** FR-010, FR-011
- **Prerequisites:** F-02, S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Which existing spaced-repetition method maps cleanly onto the three ratings? — Owner: user. Block: no (decided in `/10x-plan`).
- **Risk:** The second half of the product loop; must be comfortable on recent mobile browsers (NFR).
- **Status:** proposed

### S-07: AI content-quality rate

- **Outcome:** user can see the AI content-quality rate — accepted unchanged, accepted after correction, and rejected as "Błędne"; rejections as "Znam / nieprzydatne" are excluded from this rate and kept as a separate word-selection signal.
- **Change ID:** acceptance-rate-stats
- **PRD refs:** FR-013
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:** — (resolved 2026-11-03: proposals bulk-rejected from the "too easy" group are recorded with the reason "Za łatwe" and excluded from the content-quality rate.)
- **Risk:** The metric definition decides what the primary success criterion measures; S-01 must record per-proposal outcomes from day one (unchanged / corrected / rejected as "Błędne", "Znam / nieprzydatne" or "Za łatwe") — they cannot be reconstructed later.
- **Status:** proposed

### S-08: Password reset

- **Outcome:** user can request a password reset email and set a new password.
- **Change ID:** password-reset
- **PRD refs:** FR-001
- **Prerequisites:** —
- **Parallel with:** F-01, F-02, S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-09
- **Blockers:** —
- **Unknowns:**
  - Is the auth provider's default email sending (low hourly limit) enough, or is a custom email sender needed? — Owner: user. Block: no.
- **Risk:** Completes FR-001 on top of the existing sign-up/sign-in; independent of everything else, so it can fill gaps in the schedule.
- **Status:** ready

### S-09: Known words are never proposed again

- **Outcome:** user can generate proposals from a new lesson and never see words they previously rejected as "Znam / nieprzydatne" or "Za łatwe"; words rejected as "Błędne" may come back, and manual entry of a known word is still allowed.
- **Change ID:** skip-known-words
- **PRD refs:** US-01, FR-015
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-06, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Relies on the rejection records S-01 stores; no undo in the MVP, so a word rejected by mistake only comes back through manual entry (S-04).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                   | Suggested issue title                                    | Ready for `/10x-plan` | Notes                                       |
| ---------- | --------------------------- | -------------------------------------------------------- | --------------------- | ------------------------------------------- |
| F-01       | openrouter-generation-spike | Prove OpenRouter generation on the deployed app (< 60 s) | yes                   | Run `/10x-plan openrouter-generation-spike` |
| F-02       | flashcard-data-contract     | Per-user flashcard and tag storage with isolation        | yes                   | Run `/10x-plan flashcard-data-contract`     |
| S-01       | paste-text-generation       | Generate and review flashcards from pasted lesson text   | no                    | Waits for F-01, F-02                        |
| S-02       | pdf-lesson-generation       | Generate flashcards from a lesson PDF                    | no                    | Waits for S-01                              |
| S-03       | cefr-too-easy-grouping      | CEFR profile level and "too easy" proposal group         | no                    | Waits for S-01                              |
| S-04       | manual-word-ai-fill         | Add a word manually with AI-filled translation           | no                    | Waits for F-01, F-02                        |
| S-05       | collection-edit-and-tags    | Browse, edit, delete and tag flashcards                  | no                    | Waits for S-01                              |
| S-06       | spaced-review-session       | Spaced-repetition review by tag or general               | no                    | Waits for S-01                              |
| S-07       | acceptance-rate-stats       | Show the AI content-quality rate                         | no                    | Waits for S-01                              |
| S-08       | password-reset              | Password reset via email                                 | yes                   | Run `/10x-plan password-reset`              |
| S-09       | skip-known-words            | Never propose words rejected as known or too easy        | no                    | Waits for S-01                              |

## Open Roadmap Questions

None — all resolved (2026-11-03: 3-week MVP estimate confirmed; input limit 2,000 words; "too easy" bulk rejections recorded as "Za łatwe").

## Parked

- **Search and filter by tag (FR-009)** — Why parked: PRD nice-to-have, listed in Non-Goals for MVP.
- **Learning statistics — total / mastered / difficult (FR-012)** — Why parked: PRD nice-to-have, dropped from MVP ("difficult" has no definition).
- **OCR for PDFs without a text layer** — Why parked: PRD Non-Goals; pasting text is the workaround.
- **Languages other than English → Polish** — Why parked: PRD Non-Goals; possible future extension.
- **Shared decks, roles (teacher/admin)** — Why parked: PRD Non-Goals.
- **Audio / pronunciation** — Why parked: PRD Non-Goals.
- **Import/export from other flashcard apps** — Why parked: PRD Non-Goals.
- **Offline mode and native mobile app** — Why parked: PRD non-functional Non-Goals.
- **Per-user AI generation limits and sign-up rate limiting** — Why parked: PRD scale note says limits are needed only at larger scale; risk register lists them as mitigations if abuse appears. Deferred under the `speed` goal.
- **Error tracking beyond runtime logs** — Why parked: not required by any PRD NFR; Workers logs are enough for a solo MVP under the `speed` goal.

## Milestone History

## Done

- **F-01: (foundation) the deployed app sends lesson-sized text (up to 2,000 words) to an AI model through OpenRouter and returns structured output within 60 s with visible progress; the API key is a server-side secret.** — Archived 2026-11-10 → `context/archive/2026-11-03-openrouter-generation-spike/`. Lesson: —.
- **F-02: (foundation) flashcards and tags are stored per user, one flashcard per word per user, with many tags per flashcard, and no user can read another user's data.** — Archived 2026-11-10 → `context/archive/2026-11-10-flashcard-data-contract/`. Lesson: —.
- **S-01: user can paste lesson text with a lesson tag name, see AI proposals (word, Polish translation, additional meanings, example sentence), edit each, reject it as "Znam / nieprzydatne" or as "Błędne" (the reason is recorded for statistics), and accept the set so accepted flashcards land in the collection with the lesson tag — a word already in the collection gets the extra tag instead of a duplicate.** — Archived 2026-11-11 → `context/archive/2026-11-10-paste-text-generation/`. Lesson: —.
- **S-02: user can upload a lesson PDF with a text layer and get the same proposal review as S-01; the PDF is not retained afterwards and oversized input is rejected with a clear message.** — Archived 2026-11-11 → `context/archive/2026-11-11-pdf-lesson-generation/`. Lesson: —.
- **S-03: user can set their CEFR level and their AI model (one of the three configured in F-01) in their profile and see proposals below that level in a separate collapsed "too easy" group that they can reject in one action — bulk-rejected proposals are recorded automatically with the reason "Za łatwe".** — Archived 2026-11-11 → `context/archive/2026-11-11-cefr-too-easy-grouping/`. Lesson: —.
