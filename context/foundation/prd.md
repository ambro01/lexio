---
project: "Lexio"
version: 4
status: draft
created: 2026-10-28
updated: 2026-11-03
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2027-01-10
  after_hours_only: true
---

# Lexio — Product Requirements

## Vision & Problem Statement

A Polish learner taking 1–2 English lessons per week copies new words from the lesson materials (PDFs) into a paper notebook, which they then rarely open. Because the words are never properly practised, the same vocabulary keeps coming back in later lessons as if it were new — lesson time is spent re-learning instead of learning, and the copying itself is wasted time.

Insight: general-purpose flashcard apps are too universal for this case. This product focuses only on learning English (with Polish translations), generates flashcards from lesson PDFs or pasted text using AI — a capability mainstream apps offer only modestly and behind premium plans — and gives the author control over the learning algorithm and statistics. Other target languages are a possible future extension, not MVP.

## User & Persona

**Primary persona: the author.** Polish-speaking adult learning English with a teacher, 1–2 lessons per week, receiving lesson materials as PDFs. Reaches for the product right after a lesson (to turn the material into flashcards) and between lessons (to review). Today: hand-written notes of poor quality, rarely revisited.

- Pain category: workflow friction (manual copying), data trapped in PDFs and a notebook, no spaced-review system.
- Scale note (100× users): the domain rule itself works per user, but AI generation cost would require per-user generation limits.

## Success Criteria

### Primary

- AI content quality ≥ 75%: (accepted unchanged + accepted after correction) ÷ (all accepted + rejected as "Błędne"). Proposals rejected as "Znam / nieprzydatne" and proposals marked "Za łatwe" (bulk-rejected from the "too easy" category) are excluded — they measure word selection, not content quality.

### Secondary

- The share of AI-generated flashcards accepted without correction grows over time (accepted unchanged ÷ all accepted).
- Word-selection accuracy: the share of proposals rejected as "Znam / nieprzydatne" among proposals outside the "too easy" category falls over time. Recorded from day one; displaying it is not required in the MVP.

### Guardrails

- No AI-generated flashcard enters the collection without the user reviewing and accepting it.

## User Stories

### US-01: Generate flashcards from a lesson PDF

- **Given** a signed-in user with a lesson PDF that has a text layer
- **When** they upload the PDF, enter the lesson tag name, and AI finishes generating
- **Then** they see a list of proposals (word, Polish translation, additional meanings, example sentence), can edit or reject each one, and after accepting the set the accepted flashcards land in the collection with the lesson tag

#### Acceptance Criteria

- Nothing is saved to the collection before the set is accepted.
- A proposal is rejected with one of two buttons: "Znam / nieprzydatne" (word not worth learning — a selection miss) or "Błędne" (wrong translation, meaning or example — a quality miss). Rejected proposals do not enter the collection; the rejection reason is recorded for statistics.
- Proposals below the user's CEFR level are shown in a separate collapsed "too easy" category that can be rejected as a whole in one action; bulk-rejected proposals are recorded automatically with the rejection reason "Za łatwe" (they do not enter the collection). Every rejected proposal is therefore stored the same way — with one of three reasons: "Błędne", "Znam / nieprzydatne" or "Za łatwe".
- A word the user has ever rejected as "Znam / nieprzydatne" or "Za łatwe" is never proposed again (FR-015).
- A proposal for a word already in the collection adds the lesson tag to the existing flashcard instead of creating a duplicate.

## Functional Requirements

### Account

- FR-001: User can create an account (email + password), sign in, and reset a forgotten password via email. Priority: must-have
  > Socrates: Counter-argument considered: "password reset is a hidden cost — sending email is an extra integration in the MVP." Resolution: kept; password reset is in the MVP, because open sign-up without reset means lost accounts.

### Profile

- FR-014: User can set their English level (CEFR: A1, A2, B1, B2, C1, C2) in their profile; generation flags words below that level. Priority: must-have
  > Socrates: Counter-argument considered: "a word's CEFR level is an AI estimate with no single official list — a hard filter could hide words the user does not know." Resolution: proposals below the profile level are not removed; they are grouped in a separate collapsed "below your level / too easy" category that the user can inspect and reject as a whole with one action, without going through each card. No "I know this" known-words list. Superseded 2026-11-03 by FR-015: words rejected as "Znam / nieprzydatne" or "Za łatwe" are remembered and never proposed again.
- FR-016: User can choose in their profile which AI model generates their flashcards, from a fixed list of three models kept in the app configuration; until a choice is made, the configured default model is used. Priority: must-have
  > Decision 2026-11-03 (while planning the AI generation change): lets the author compare models and switch when one gives better Polish translations. The list itself is changed only in the app configuration, not by users.

### AI generation

- FR-002: User can upload a lesson PDF (with a text layer) so that AI generates flashcard proposals. Priority: must-have
  > Socrates: Counter-argument considered: "lesson PDFs are not only vocabulary (exercises, instructions, grammar) — AI may flood the review with words the user already knows and push acceptance below 75%." Resolution: kept; addressed by the user's CEFR level (FR-014).
- FR-003: User can paste text so that AI generates flashcard proposals. Priority: must-have
  > Socrates: Counter-argument considered: "duplicates FR-002." Resolution: kept; same review flow, different input — cheap, and a workaround for PDFs without a text layer.
- FR-004: User can review the proposals — edit, reject (as "Znam / nieprzydatne" or as "Błędne"), and accept the set. Priority: must-have
  > Socrates: Counter-arguments offered (long-list fatigue, interrupted review). Resolution: no counter-argument; stands as written.
- FR-005: Accepted flashcards are tagged with the lesson they came from; the user enters the lesson tag name at upload time. Each word exists in the collection only once — if a proposal matches a word already in the collection, the existing flashcard gets the additional lesson tag instead of a duplicate. Priority: must-have
  > Socrates: Counter-argument considered: "the same word may appear in two lessons — duplicate or extra tag?" Resolution: a word occurs only once and can carry many tags.
- FR-015: A word the user has ever rejected as "Znam / nieprzydatne" or "Za łatwe" is never proposed again in later generations (from PDF or pasted text). Words rejected as "Błędne" may be proposed again. Adding such a word manually (FR-006) is still allowed. Priority: must-have
  > Decision 2026-11-03: added so that proposal quality improves over time — the app learns which words the user already knows. No undo in the MVP; manual entry is the workaround for a word rejected by mistake.

### Manual flashcards

- FR-006: User can enter a word or phrasal verb manually, optionally with a context sentence; AI fills in the Polish translation (in the meaning matching the context), additional meanings and an example sentence, which the user reviews before saving. Priority: must-have
  > Socrates: Counter-argument considered: "ambiguous words (e.g. 'bank', 'get over') — AI may pick a different meaning than the lesson's." Resolution: optional context field; other meanings go to "additional meanings".
- FR-007: User can edit and delete flashcards in the collection. Priority: must-have
  > Socrates: Counter-arguments considered: edit vs learning history; deletion vs acceptance rate. Resolution: editing does not change learning progress. Deleting a flashcard after it was accepted (not to be confused with rejecting a proposal) may affect the acceptance rate; mass deletion is not expected.

### Tags

- FR-008: User can tag flashcards (e.g. "w pracy", "w podróży"); the app suggests existing tags and allows typing new ones. A "set" is simply a tag — no separate set entity. Priority: must-have
  > Socrates: Counter-argument considered: "tags will drift ('w podróży', 'Podróż', 'travel')." Resolution: suggest existing tags, allow new ones.
- FR-009: User can search and filter flashcards by tag. Priority: nice-to-have

### Review

- FR-010: User can start a review in one of two modes: (a) by tag — e.g. a lesson tag — selecting from that tag's flashcards; (b) general — selecting from the whole collection, with a user-set limit on the number of cards per session. In both modes card selection and order follow the spaced-repetition algorithm, so weaker cards appear more often. Priority: must-have
  > Socrates: Counter-argument considered: "reviewing by tag bypasses the schedule; there is no 'review everything' option." Resolution: two modes, both algorithm-driven; general mode has a session limit.
- FR-011: User can rate a card as "Nie pamiętam", "Trudne" or "Łatwe" (mapped onto the scale of an existing, not self-invented, spaced-repetition algorithm), and can separately mark a card as "Opanowane", which removes it from general-mode review (it stays in tag review and the mark can be undone). Priority: must-have
  > Socrates: Counter-argument considered: "an existing algorithm has its own rating scale; 'mastered' is not a recall rating but a decision to exclude the card." Resolution: 3 ratings + a separate "Opanowane" button.

### Statistics

- FR-012: User can see statistics: number of flashcards, mastered, difficult. Priority: nice-to-have
  > Socrates: Counter-argument considered: "'difficult' has no definition." Resolution: dropped from the MVP.
- FR-013: User can see the AI content-quality rate of generated flashcards (accepted unchanged vs accepted after correction vs rejected as "Błędne"); rejections as "Znam / nieprzydatne" are recorded separately as a word-selection signal and are not part of this rate. Priority: must-have
  > Decision 2026-11-03: rejections are split by reason so that content quality (model/prompt) and word selection (CEFR filter) can be improved independently.
  > Socrates: Counter-argument considered: "this is a product metric for the author rather than a learning feature." Resolution: kept in the UI.

## Non-Functional Requirements

- Flashcard proposals from a typical lesson PDF (up to ~10 pages) are ready in < 60 s, with continuous visible progress during generation.
- Generation accepts input up to 2,000 words (pasted text or text extracted from a PDF); larger input is rejected with a clear message.
- An uploaded PDF is not retained after the proposals are generated; only the flashcards remain.
- Review is comfortable in the latest two major versions of the mainstream mobile browsers.
- A user never sees another user's flashcards, tags or statistics.

## Business Logic

The app selects from lesson material the words worth learning at the user's level, and then schedules their reviews so that less well remembered flashcards come back more often.

Inputs: lesson material (PDF with a text layer, or pasted text) or a manually entered word with optional context; the user's CEFR level from their profile; the words already in the user's collection; the words the user has rejected as "Znam / nieprzydatne" or "Za łatwe"; and the user's ratings of each card ("Nie pamiętam", "Trudne", "Łatwe") plus the separate "Opanowane" mark.

Outputs: (1) a reviewable list of flashcard proposals, with words below the user's level grouped as "too easy" and words already in the collection turned into an extra tag instead of a duplicate, and words previously rejected as known or too easy left out entirely; (2) for each review session, which cards to show and in what order — the scheduling follows an existing spaced-repetition method, not a self-invented one; "Opanowane" cards are excluded from general review.

The user meets the rule twice: when reviewing proposals after uploading a lesson, and when starting a review (by tag, or general with a session limit).

## Access Control

- Sign-in: email + password.
- Sign-up: open — anyone can create an account.
- Roles: none (flat model). Each user sees and edits only their own flashcards, tags, sets and statistics; no user can see another user's data.
- Unauthenticated user: sees only the sign-in / sign-up screen; every other route redirects to sign-in.

## Non-Goals

### Functional

- No self-designed spaced-repetition algorithm — an existing method is used.
- No PDFs without a text layer (no OCR for scans/photos) — pasting text is the workaround.
- No languages other than English words with Polish translations — other languages are a possible future extension.
- No shared decks and no roles (teacher/admin) — single-tenant, each user sees only their own data.
- No audio / pronunciation (recordings or speech synthesis).
- No import/export from/to other flashcard apps.
- Not in MVP (nice-to-have): search/filter by tag (FR-009), learning statistics — total / mastered / difficult (FR-012).

### Non-functional

- No offline mode — the app requires an internet connection.
- No native mobile app (store distribution) — browser only, including mobile browsers.

## Open Questions

None — all resolved. (2026-11-03: input limit set to 2,000 words; "too easy" bulk rejections recorded as "Za łatwe"; 3-week MVP estimate confirmed.)
