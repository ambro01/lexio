---
project: "Lexio"
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
created: 2026-10-28
updated: 2026-10-28
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "context type"
      decision: "greenfield — directory holds only an empty HTML5 boilerplate template"
    - topic: "pain category"
      decision: "workflow friction (manual copying) + data trapped in lesson PDFs/notebook + no review system"
    - topic: "primary persona scope"
      decision: "single named user — the author; Polish learner with 1-2 English lessons per week"
    - topic: "translation language"
      decision: "Polish only for MVP; other languages a future extension"
    - topic: "auth strategy"
      decision: "email + password login; open sign-up; flat model, no roles"
    - topic: "MVP timeline"
      decision: "full seed scope in ~3 weeks after-hours (user estimate); no scope-down needed"
    - topic: "tag vs set"
      decision: "a set is simply a tag; no separate set entity"
  frs_drafted: 14
  quality_check_status: accepted
---

# Shape notes

## Seed idea (verbatim)

Aplikacja webowa do nauki angielskich słówek i phrasal verbs metodą fiszek. Użytkownik wpisuje słówko ręcznie, AI generuje tłumaczenie, dodatkowe znaczenia i przykład zdania. Powtórki z oceną „Nie pamiętam / Trudne / Łatwe”, słabo znane słówka pojawiają się częściej. Tagi do wyszukiwania i tworzenia zestawów („w pracy”, „w podróży”). Statystyki: liczba fiszek, opanowane, trudne. Liczenie wskaźnika akceptacji przez użytkownika fiszek generowanych przez AI.
Generowanie fiszek na podstawie wprowadzonego tekstu lub import PDF (z warstwą tekstową, PDF to materiały z lekcji angielskiego): AI generuje fiszki, a użytkownik je przegląda, poprawia i akceptuje.

Otwarte pytania (z odpowiedziami użytkownika):

- Według jakiego algorytmu planować powtórki? Chciałbym użyć gotowego algorytmu, nie chcę wymyślać własnego.
- Co znaczy „słówko opanowane”? Dodamy opcję "opanowane" przy ocenie użytkownika.
- Co zrobić, gdy AI wygeneruje błędne tłumaczenie? Użytkownik je poprawi lub usunie tę fiszkę.

Mocno zależy mi na imporcie z PDF. Obecnie po lekcji angielskiego robię ręczne notatki, ale są słabej jakości i rzadko do nich wracam.

## Vision & Problem Statement

A Polish learner taking 1–2 English lessons per week copies new words from the lesson materials (PDFs) into a paper notebook, which they then rarely open. Because the words are never properly practised, the same vocabulary keeps coming back in later lessons as if it were new — lesson time is spent re-learning instead of learning, and the copying itself is wasted time.

Insight: general-purpose flashcard apps are too universal for this case. This product focuses only on learning English (with Polish translations), generates flashcards from lesson PDFs or pasted text using AI — a capability mainstream apps offer only modestly and behind premium plans — and gives the author control over the learning algorithm and statistics. Other target languages are a possible future extension, not MVP.

## User & Persona

**Primary persona: the author.** Polish-speaking adult learning English with a teacher, 1–2 lessons per week, receiving lesson materials as PDFs. Reaches for the product right after a lesson (to turn the material into flashcards) and between lessons (to review). Today: hand-written notes of poor quality, rarely revisited.

- Pain category: workflow friction (manual copying), data trapped in PDFs and a notebook, no spaced-review system.
- Scale note (100× users): the domain rule itself works per user, but AI generation cost would require per-user generation limits.

## Access Control

- Sign-in: email + password.
- Sign-up: open — anyone can create an account.
- Roles: none (flat model). Each user sees and edits only their own flashcards, tags, sets and statistics; no user can see another user's data.
- Unauthenticated user: sees only the sign-in / sign-up screen; every other route redirects to sign-in.

## MVP flow

1. User signs in.
2. User uploads a lesson PDF (text layer) — or pastes text instead.
3. AI generates flashcard proposals: word / phrasal verb, Polish translation, additional meanings, example sentence.
4. User reviews the proposals: edits some, rejects some.
5. User accepts the set; accepted flashcards land in the collection tagged with that lesson. ← first visible value
6. Later, user starts a review of this lesson, another lesson, or other cards.
7. User rates each card; the app schedules when it appears again.

Timeline budget: `mvp_weeks: 3` (user estimate, full seed scope). Riskiest piece: PDF text extraction + AI generation must both work before any value is visible.

## Success Criteria

### Primary

- ≥ 75% of AI-generated flashcards are accepted by the user (unchanged or after correction).

### Secondary

- The share of AI-generated flashcards accepted without correction grows over time.

### Guardrails

- No AI-generated flashcard enters the collection without the user reviewing and accepting it.

## Functional Requirements

### Account

- FR-001: User can create an account (email + password), sign in, and reset a forgotten password via email. Priority: must-have
  > Socrates: Counter-argument considered: "password reset is a hidden cost — sending email is an extra integration in the MVP." Resolution: kept; password reset is in the MVP, because open sign-up without reset means lost accounts.

### Profile

- FR-014: User can set their English level (CEFR: A1, A2, B1, B2, C1, C2) in their profile; generation flags words below that level. Priority: must-have
  > Socrates: Counter-argument considered: "a word's CEFR level is an AI estimate with no single official list — a hard filter could hide words the user does not know." Resolution: proposals below the profile level are not removed; they are grouped in a separate collapsed "below your level / too easy" category that the user can inspect and reject as a whole with one action, without going through each card. No "I know this" known-words list.

### AI generation

- FR-002: User can upload a lesson PDF (with a text layer) so that AI generates flashcard proposals. Priority: must-have
  > Socrates: Counter-argument considered: "lesson PDFs are not only vocabulary (exercises, instructions, grammar) — AI may flood the review with words the user already knows and push acceptance below 75%." Resolution: kept; addressed by the user's CEFR level (FR-014).
- FR-003: User can paste text so that AI generates flashcard proposals. Priority: must-have
  > Socrates: Counter-argument considered: "duplicates FR-002." Resolution: kept; same review flow, different input — cheap, and a workaround for PDFs without a text layer.
- FR-004: User can review the proposals — edit, reject, and accept the set. Priority: must-have
  > Socrates: Counter-arguments offered (long-list fatigue, interrupted review). Resolution: no counter-argument; stands as written.
- FR-005: Accepted flashcards are tagged with the lesson they came from; the user enters the lesson tag name at upload time. Each word exists in the collection only once — if a proposal matches a word already in the collection, the existing flashcard gets the additional lesson tag instead of a duplicate. Priority: must-have
  > Socrates: Counter-argument considered: "the same word may appear in two lessons — duplicate or extra tag?" Resolution: a word occurs only once and can carry many tags.

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
- FR-013: User can see the acceptance rate of AI-generated flashcards (accepted unchanged vs accepted after correction vs rejected). Priority: must-have
  > Socrates: Counter-argument considered: "this is a product metric for the author rather than a learning feature." Resolution: kept in the UI.

## User Stories

### US-01: Generate flashcards from a lesson PDF

- **Given** a signed-in user with a lesson PDF that has a text layer
- **When** they upload the PDF, enter the lesson tag name, and AI finishes generating
- **Then** they see a list of proposals (word, Polish translation, additional meanings, example sentence), can edit or reject each one, and after accepting the set the accepted flashcards land in the collection with the lesson tag

#### Acceptance Criteria

- Nothing is saved to the collection before the set is accepted.
- Rejected proposals do not enter the collection but count towards the acceptance rate.
- Proposals below the user's CEFR level are shown in a separate collapsed "too easy" category that can be rejected as a whole in one action.
- A proposal for a word already in the collection adds the lesson tag to the existing flashcard instead of creating a duplicate.

## Business Logic

The app selects from lesson material the words worth learning at the user's level, and then schedules their reviews so that less well remembered flashcards come back more often.

Inputs: lesson material (PDF with a text layer, or pasted text) or a manually entered word with optional context; the user's CEFR level from their profile; the words already in the user's collection; and the user's ratings of each card ("Nie pamiętam", "Trudne", "Łatwe") plus the separate "Opanowane" mark.

Outputs: (1) a reviewable list of flashcard proposals, with words below the user's level grouped as "too easy" and words already in the collection turned into an extra tag instead of a duplicate; (2) for each review session, which cards to show and in what order — the scheduling follows an existing spaced-repetition method, not a self-invented one; "Opanowane" cards are excluded from general review.

The user meets the rule twice: when reviewing proposals after uploading a lesson, and when starting a review (by tag, or general with a session limit).

## Non-Functional Requirements

- Flashcard proposals from a typical lesson PDF (up to ~10 pages) are ready in < 60 s, with continuous visible progress during generation.
- Generation accepts input up to a defined size (e.g. 10 pages / 20,000 characters); larger input is rejected with a clear message.
- An uploaded PDF is not retained after the proposals are generated; only the flashcards remain.
- Review is comfortable in the latest two major versions of the mainstream mobile browsers.
- A user never sees another user's flashcards, tags or statistics.

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

## Forward: tech-stack

Informational, not part of the PRD schema.

- Mobile browsers to verify review comfort on: current Chrome and Safari.
- Competitor flashcard apps mentioned (excluded from import/export in MVP): Anki, Quizlet.

## Open Questions (running)

1. Do proposals bulk-rejected from the "too easy" category count towards the AI acceptance rate (Primary success criterion ≥ 75%)? — Owner: user.

## Quality cross-check

Run 2026-10-28 — all items present (Access Control, Business Logic, project artifacts, timeline-cost acknowledgment via mvp_weeks: 3, Non-Goals). Note: the 3-week estimate was given before password reset, CEFR level filtering and word de-duplication were added to scope; the user accepted it as is.
