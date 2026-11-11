<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Manual Word with AI Fill

- **Plan**: context/changes/manual-word-ai-fill/plan.md
- **Scope**: Full plan (completed phases only)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

Phase 4 is not reviewed: its row 4.1 (CI green on `master`) is still open, because the CI run for `91f7b1b` (43097437312) stayed queued on GitHub. The docs it changed (README/AGENTS) were checked only as part of the Phase 4 commit.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Success criteria re-run on 2026-11-11:

- **Passed:**
  - `npm run db:types`: identical to the committed file.
  - `npm run check:rls`: all pass.
  - `npm test`: 169 pass.
  - `npm run lint`, `npx astro check`: clean, 0 errors.
  - `npm run build` + `check:client-only` (dev server stopped during the build), `npm run smoke`: all pass.
- **Not re-run:** `npx supabase db reset`, to keep the local test data. It ran in Phase 1.
- **Manual checks:** all Phase 1–3 checks were ticked after user confirmation.

Plan adherence: every planned change in Phases 1–3 matches; nothing is missing and nothing extra beyond the disclosed adaptations.

Verified:

- The recreated `accept_proposal_set` keeps lesson behaviour. The body was compared line by line with the original; only the source, tag and item rules changed.
- The revoke/grant moved to the new signature. The old 3-argument function is dropped.
- The 1-item manual rule can't be bypassed.
- The shared OpenRouter request doesn't change lesson generation (same prompt, schema name, `max_tokens` 8000, timeout, errors, usage).
- The word-fill endpoint never logs the word or the context, and the 409 path makes no model call.
- Manual outcomes compare the AI fill (never the typed word) with the saved card.
- The AddWord state machine can't double-submit, and an older fill can't overwrite a newer one.

## Findings

### F1 — Saving an edited word that is already in the collection merges silently, but the page says "Zapisano"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/manual/AddWord.tsx:196-236; src/lib/manual-word.ts (toManualAcceptRequest)
- **Detail**:
  - The two collection checks cover the typed word (409) and the AI-filled word (badge + blocked "Zapisz").
  - But the user can still edit the card's word into one they already have, and a failed lookup also lets an existing word through.
  - `save_flashcard` then only adds the tag and leaves the card's content unchanged, so the user's translation edits are dropped.
  - An outcome row is written with `merged = true`, `source = 'manual'`.
  - The page ignores the result's `merged` count and shows "Zapisano: <word>", so the user believes their edits were saved.
- **Fix**: When the save result reports `merged === 1`, show "To słowo już było w kolekcji — treść nie została zmieniona" (plus "dodano tag" when a tag was given) instead of "Zapisano".
- **Decision**: FIXED — when the save merged, the page says "„<word>” już było w kolekcji — treść nie została zmieniona (dodano tag)" instead of "Zapisano"

### F2 — The 800-token cap for word fill may cut off answers from reasoning models

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/ai-generation.service.ts:12
- **Detail**:
  - On OpenRouter, some providers count "reasoning" tokens toward `max_tokens`.
  - If `openai/gpt-6-luna` or `google/gemini-3.8-flash` reason by default, a fill could be cut off mid-JSON. That surfaces as a 502 "Model AI nie odpowiedział poprawnie".
  - Only the default model (Claude Haiku 5.5) was exercised in the manual and production checks. Lesson generation uses 8000 tokens, so it never had this risk.
- **Fix**: Raise `WORD_FILL_MAX_TOKENS` to 2000.
  - Strength: The output size is already bounded by the strict schema and `toValidProposal` limits, so a higher cap only matters when a model reasons first.
  - Tradeoff: A slightly higher worst-case cost per fill on reasoning models.
  - Confidence: MED — the reasoning behaviour of the two other models was not verified.
  - Blind spot: No live fill was run with the other two models. Trying one fill per model in `/profile` would settle it.
- **Decision**: FIXED — WORD_FILL_MAX_TOKENS raised to 2000 (test updated)

### F3 — The accept request lets a manual save carry a rejection

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/ai/outcomes.ts:105-149
- **Detail**: A hand-crafted `POST /api/proposal-sets` with `source: "manual"` and `decision: "reject_wrong"` writes a `rejected_*` row marked `manual`. The page never sends that, and it only affects the user's own data, but S-07 could misread such rows.
- **Fix**: Add one zod refine: `source !== "manual" || items[0].decision === "accept"`, plus a test.
- **Decision**: FIXED — acceptRequestSchema: a manual save must accept its item, + test

### F4 — A filled word already in the collection can't be edited back

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/review-draft.ts:66; src/components/lesson/ProposalReviewItem.tsx:206
- **Detail**:
  - The lesson rule "words in the collection can't be edited" also applies on `/add`.
  - So when "went" is filled as "go" and "go" is already yours, the card has no "Edytuj". You must discard the fill, or change the input and fill again.
  - The plan only asked for the badge and a blocked "Zapisz", so this fits. The badge text ("dostanie tag") was already accepted by the user.
- **Fix**: Accept; "Odrzuć" and "Uzupełnij ponownie" cover it.
- **Decision**: ACCEPTED — "Odrzuć" / "Uzupełnij ponownie" cover it

### F5 — AddWord duplicates LessonGenerator's request and error helpers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/manual/AddWord.tsx (postJson, ErrorBox, Spinner)
- **Detail**: The two islands keep near-identical copies of the JSON POST helper and the error box. The error mapping now lives in two places.
- **Fix**: Accept for now; extract a shared helper when a third island needs it.
- **Decision**: ACCEPTED — extract when a third island needs the helpers
