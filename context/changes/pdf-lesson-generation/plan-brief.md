# PDF Lesson Generation — Plan Brief

> Full plan: `context/changes/pdf-lesson-generation/plan.md`

## What & Why

Roadmap slice S-02 (US-01, FR-002): the learner gets lesson materials as PDFs, so "Nowa lekcja" should accept a lesson PDF directly instead of requiring copy-paste. The PDF's text goes through the same AI proposal review that S-01 built.

## Starting Point

S-01 is live. `/generate` has a tag field, a text area with a 2,000-word counter, generation via `POST /api/ai/proposals`, a localStorage draft, review and accept. The infrastructure decision already says PDF text must be extracted in the browser, because server-side parsing would exceed the Worker's 10 ms CPU limit.

## Desired End State

"Nowa lekcja" has **Tekst** and **PDF** tabs. On the PDF tab the user picks a file and sees reading progress, then the file name and word count. The tag is prefilled from the file name if empty, and Generuj leads to the usual review. Long PDFs are cut to their first 2,000 words with a notice. Scanned, locked or invalid files get a clear message. The PDF never leaves the device.

## Key Decisions Made

| Decision                   | Choice                                                                                  | Why (1 sentence)                                                                                 | Source          |
| -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------- |
| Where PDFs are parsed      | In the browser (pdf.js), only text is sent                                              | The Worker's 10 ms CPU limit rules out server parsing, and the file is never retained            | Infrastructure  |
| Library                    | `pdfjs-dist` 6.5, **legacy build**, loaded on demand                                    | The modern build needs iOS 26.2+ / Chrome 147+; `unpdf` has no Web Worker and would block the UI | Plan (research) |
| How the PDF feeds the form | Separate Tekst / PDF tabs; the PDF tab shows the file name and word count, not the text | Your choice: a clean split between the two inputs                                                | Plan            |
| PDF over 2,000 words       | Truncate to the first 2,000 words with a notice; pasted text is still rejected          | Your choice; long lessons stay usable                                                            | Plan            |
| PRD conflict               | Update the PRD NFR to say PDF text is truncated                                         | Keeps the PRD true after the decision above                                                      | Plan            |
| Text cleanup               | Drop lines repeated on ≥60% of pages and page-number-only lines                         | More of the 2,000-word budget goes to lesson content                                             | Plan            |
| Tag                        | Prefill from the file name only when the tag field is empty                             | Saves typing on a phone without overriding the user                                              | Plan            |
| Testing                    | Unit tests plus pdf.js run in Vitest on PDFs generated in the test                      | Catches pdf.js upgrade breakage and the scanned-PDF path with no binary fixtures                 | Plan            |
| Source in outcome records  | Not recorded                                                                            | No migration; the PRD metric is not split by input                                               | Plan            |
| Limits                     | 20 MB file, first 30 pages read                                                         | Protects phone memory; lessons are about 10 pages                                                | Plan            |

## Scope

**In scope:**

- Text rules and extraction module, with tests.
- PDF tab, lazy pdf.js loading and Polish error messages.
- A CI check that pdf.js stays out of the server bundle.
- The PRD, README and AGENTS.md updates.
- A production check on a phone.

**Out of scope:**

- OCR, server-side parsing, and storing the PDF or its text.
- A preview or editing of the extracted text.
- Changes to the API, the database or the outcome records.
- S-03 and S-09 features, Wake Lock and rate limiting.

## Architecture / Approach

There are two new modules under `src/lib/pdf/`:

- `lesson-text.ts` (pure): lines → drop repeated headers and page numbers → text → truncate within the server's word and character limits.
- `extract.ts`: drives pdf.js. It receives the pdf.js library as a parameter, so Vitest can run it in Node on generated PDFs.

The browser loads the legacy build only inside the file-change handler (`browser.ts`, dynamic import behind `import.meta.env.SSR`). The extracted text goes to the existing `generate()`, and everything after that is S-01 unchanged.

## Phases at a Glance

| Phase                         | What it delivers                                                            | Key risk                                                             |
| ----------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. PDF text extraction core   | `pdfjs-dist`, text rules, extraction module, tests on generated PDFs        | pdf.js behaving differently in Node and in the browser               |
| 2. PDF tab in the lesson form | Tabs, lazy SSR-safe loading, errors, tag prefill, `check:client-only` in CI | pdf.js leaking into the Worker bundle and being evaluated on workerd |
| 3. Docs and production check  | PRD rule, README/AGENTS, push, a real PDF on a phone                        | Mobile browser quirks with real teacher PDFs                         |

**Prerequisites:** S-01 deployed (done), with no migration needed. A few real lesson PDFs (including a scanned one) for the manual checks.
**Estimated effort:** about 2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Real teacher PDFs may lay out text oddly (columns, tables). The AI tolerates some noise, and the cleanup only removes repeated lines.
- The legacy build targets Safari 18+ and Chrome 125+. The current mobile versions were estimated, not checked on devices.
- The 60%-of-pages header rule could drop a genuine line repeated on every page (rare).

## Success Criteria (Summary)

- A learner can turn a real lesson PDF into reviewed flashcards on a phone within 60 s, with no copy-paste.
- Unusable PDFs (scans, locked or invalid files) get a clear message instead of a failed generation.
- pdf.js never reaches the server bundle, and the Worker's CPU use is unchanged.
