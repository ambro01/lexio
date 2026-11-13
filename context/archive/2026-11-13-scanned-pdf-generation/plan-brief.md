# Scanned PDF Generation — Plan Brief

> Full plan: `context/changes/scanned-pdf-generation/plan.md`
> Research: `context/changes/scanned-pdf-generation/research.md`

## What & Why

Roadmap slice S-10 (US-01, FR-017). Most of the author's lesson PDFs are image-only: scanned or exported pages with no text layer, and their text cannot be copied either. Today the app rejects them. This change lets the learner upload such a PDF and get the same flashcard proposal review as a text PDF.

## Starting Point

S-02 reads PDF text in the browser with pdf.js and sends only text to `POST /api/ai/proposals`. When a PDF has fewer than 20 words of text, it shows "Ten PDF nie ma warstwy tekstowej (np. skan)". All three configured models accept images. On the sample `lesson.pdf` (7 image-only pages), Haiku 5.5 transcribed every page word for word in about 6 s for about $0.004.

## Desired End State

On the PDF tab, an image-only PDF triggers "Odczytuję skan… strona X / Y". The panel then shows the word count, "Odczytano skan: N z M stron" and any unreadable page numbers. Generuj leads to the usual review, within 60 s for a lesson of up to ~10 pages. The PDF never leaves the device, and page images are neither stored nor logged.

## Key Decisions Made

| Decision           | Choice                                                                                  | Why (1 sentence)                                                                            | Source          |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------- |
| How scans are read | Vision model on page images rendered in the browser                                     | All 3 models read images; measured fast, cheap and accurate; no OCR library or PDF upload   | Research        |
| Flow shape         | Transcribe each page, then join the text and run one existing generation call           | The model sees the whole lesson; the word limit, review and proposals route stay unchanged  | Plan            |
| Sending pages      | One page per request (~200 KB), 3 at a time                                             | Small requests fit the 10 ms CPU limit and give per-page progress and an unreadable signal  | Plan            |
| Model              | The user's profile model (default Haiku 5.5)                                            | One model rule across the app                                                               | Plan            |
| CPU over the limit | Only smaller images (one width/quality knob); no Paid plan                              | Your choice: stay at $0; if it is not enough, the feature is blocked pending a new decision | Plan            |
| Time target        | Same < 60 s as text PDFs (up to ~10 pages)                                              | Measured ~6 s reading + 14–32 s generation fits                                             | Plan (PRD OQ 1) |
| Unreadable pages   | Skip them and name them; if nothing is readable, show a clear message with no proposals | One bad page does not block the lesson, and the user knows what is missing                  | Plan (PRD OQ 2) |
| Teacher marks      | Transcribe them as text, with no prioritisation                                         | The generation prompt and quality metric stay unchanged                                     | Plan            |
| Limits             | At most 15 pages; stop once the text exceeds 2,000 words; existing truncation applies   | Bounds cost and time; pages past the word limit would be cut anyway                         | Plan            |
| Unreadable signal  | Strict JSON `{ text, unreadable }` from the model                                       | The model flags a bad page instead of returning garbage                                     | Plan            |

## Scope

**In scope:**

- A page-text contract module, `transcribePage` (multimodal request) and `POST /api/ai/page-text`, with tests.
- Rendering pages in the browser, the scan orchestration with tests, and the scan path on the PDF tab.
- `lesson.pdf` in `.gitignore`, a contract-surfaces row, PRD Open Questions 1–2 resolved, and README/AGENTS notes.
- A production check on a phone, plus a CPU check in Workers logs.

**Out of scope:**

- Changes to the proposals route, the generation prompt, the database or the outcome records.
- A preview or editing of the transcribed text, and any prioritisation of teacher marks.
- Browser OCR libraries, OpenRouter PDF engines and the Workers Paid plan.
- Mixed PDFs (text plus images), phone photos and handwriting, rate limiting, and automatic retries.

## Architecture / Approach

```
PDF tab → extractLessonText → no_text?
   └─ scan.ts: render page (render.ts, 1240 px JPEG) ─┬─ POST /api/ai/page-text ─→ OpenRouter (profile model)
                                3 pages at a time ────┘        { text, unreadable }
      join in page order → drop repeated lines → truncate to 2,000 words
→ existing onText → Generuj → POST /api/ai/proposals (unchanged) → review
```

## Phases at a Glance

| Phase                              | What it delivers                                                                         | Key risk                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Page transcription endpoint     | Page-text contract, multimodal service call, `/api/ai/page-text`, tests, `.gitignore`    | Widening the shared AI request must not change word-fill or generation |
| 2. Scanned-PDF path in the browser | Page rendering, the scan orchestration (concurrency, limits, order), PDF tab integration | Canvas memory on phones; pdf.js 6 render API details                   |
| 3. Docs and production check       | PRD/README/AGENTS, deploy, `lesson.pdf` on a phone, CPU check in logs                    | Worker CPU over 10 ms per page, with smaller images as the only remedy |

**Prerequisites:** S-02 deployed (done). `lesson.pdf` available locally. `OPENROUTER_API_KEY` in `.env` for the dev checks.
**Estimated effort:** about 2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Per-page CPU on the Free plan is unmeasured. The about 200 KB requests are expected to fit, but this is checked only in Phase 3.
- Only one real lesson was measured, and it was a clean digital page. Real paper scans (skew, noise) may produce more unreadable pages.
- The per-page wall time at concurrency 3 is inferred from a single 7-page call, not measured.
- Lessons longer than about 9 pages hit the 2,000-word limit and are truncated, as with text PDFs.

## Success Criteria (Summary)

- A learner turns an image-only lesson PDF into reviewed flashcards on a phone within 60 s, without copy-paste.
- Unreadable pages are named, and an unreadable scan gets a clear message instead of a failed generation.
- No PDF, page image or transcribed text is stored or logged, and Worker requests stay within the Free-plan CPU limit.
