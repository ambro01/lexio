---
date: 2026-11-13T19:24:05+01:00
researcher: Claude (Opus 5.5) for Rafal A
git_commit: c060b66b4e3ae5bfcc43339349f571df415bd0d6
branch: master
repository: lexio
topic: "How can Lexio read scanned lesson PDFs (no text layer) and feed them into the existing proposal flow (S-10, FR-017)?"
tags: [research, codebase, pdf, ocr, vision, openrouter, cloudflare-workers, scanned-pdf-generation]
status: complete
last_updated: 2026-11-13
last_updated_by: Claude (Opus 5.5)
---

# Research: Reading scanned lesson PDFs for AI flashcard proposals

**Date**: 2026-11-13T19:24:05+01:00
**Researcher**: Claude (Opus 5.5) for Rafal A
**Git Commit**: c060b66b4e3ae5bfcc43339349f571df415bd0d6
**Branch**: master
**Repository**: lexio

## Research Question

Roadmap slice S-10 `scanned-pdf-generation` (FR-017): a learner uploads a lesson PDF made of scanned printed pages (no text layer) and gets the same proposal review as S-02, without the PDF being retained. Research questions from the roadmap (`context/foundation/roadmap.md`, S-10 Unknowns):

1. How does the text of a scanned page get read (vision model vs OCR), and does that fit the 60 s generation budget and the app's request-size limits for a typical lesson (up to ~10 pages)?
2. Which of the three configured AI models can read scanned pages, and at what cost per page?
3. How does the "PDF is not retained" rule hold?
4. What input is needed for the two open PRD questions (time target for scans; unreadable pages)?

## Summary

- **Today a scanned PDF is rejected in the browser** with `no_text` when the extracted text has fewer than 20 words (`src/lib/pdf/extract.ts:16`, `:84-86`); the user is told to paste text instead (`src/components/lesson/PdfLessonInput.tsx:30`). The S-02 manual check found that 3 of 4 real lesson PDFs are image-only jsPDF exports (one image per page), and their text cannot be copied either, so the paste workaround does not help (`context/archive/2026-11-11-pdf-lesson-generation/change.md:14`).
- **All three configured models accept images and PDF files** on OpenRouter: `anthropic/claude-haiku-5.5`, `openai/gpt-6-luna` and `google/gemini-3.8-flash` each list `image` and `file` in `architecture.input_modalities` (OpenRouter `GET /api/v1/models`, fetched 2026-11-13; model list in `src/lib/ai/models.ts:6-8`). No model change is required to read page images.
- **The generation call is text-only today.** Messages are `{role, content: string}` (`src/lib/services/ai-generation.service.ts:126`, `:161-164`), the user message is `Lesson text:\n\n${text}` (`:221`), and the route caps the body at 1.2 MB by `Content-Length` (`src/pages/api/ai/proposals.ts:18-20`, `:75`) with zod `text` max 300,000 chars (`:22-25`). Page images need either a new route/body shape or a changed one.
- **Recommended direction (inference, not a decision):** render pages to grayscale JPEG in the browser with the pdf.js already loaded for S-02, send them as `image_url` data-URL parts to the user's configured vision model, and turn them into lesson text that then goes through the existing text pipeline (word limit, truncation, review). Estimated cost for a 10-page lesson is under ~$0.02 and latency roughly 5–20 s per vision call (estimates, see Detailed Findings). The PDF itself never leaves the device; only rendered page images are sent, in memory, and not stored by Lexio.
- **Main constraint to settle in the plan:** production runs on the Cloudflare Workers **Free** plan with 10 ms CPU per request (`context/foundation/infrastructure.md:17`, `:71`). A 1–3 MB JSON body with base64 images must be parsed and re-serialized in the Worker; whether that stays under 10 ms CPU is **not measured**. Options: pass the body through with minimal parsing, keep images small/few, or move to the $5 Paid plan (the documented fallback, `infrastructure.md:17`).
- **Cheaper non-LLM fallback exists but is weaker on phones:** tesseract.js in the browser costs $0 and sends nothing but text, but needs ~3 MB model + wasm download and is estimated at 40–100 s for 10 pages on a mid-range phone (estimate), which breaks the 60 s target. OpenRouter's free `cloudflare-ai` PDF engine and Workers AI `toMarkdown` **do not OCR** scanned pages.

## Detailed Findings

### 1. Current PDF → text path (browser)

- pdfjs-dist `^6.5.438` (`package.json:36`), legacy minified build lazy-loaded in `src/lib/pdf/browser.ts:9-19`; `scripts/check-client-only.mjs` keeps pdf.js out of the Worker bundle (`AGENTS.md:14`, `:26`).
- Limits in `src/lib/pdf/extract.ts`: `MAX_PDF_BYTES` 20 MB (`:10`), `MAX_PDF_PAGES` 30 (`:11`; extra pages skipped, `:74`), `MIN_TEXT_WORDS` 20 (`:16`).
- Flow (`extract.ts:62-94`): size check → `getDocument` → per page `getTextContent` (`:78`) → drop repeated header/footer lines → `toLessonText` → `no_text` if under 20 words (`:84-86`) → `truncateToLimit` to 2,000 words / 30,000 chars (`src/lib/pdf/lesson-text.ts:117`).
- The `PdfJsModule` interface exposes only `getTextContent` (`extract.ts:22-33`); rendering a page to a canvas (`page.getViewport` + `page.render`) would need the interface and the type shim `src/lib/pdf/pdfjs-min.d.ts` extended.
- UI: per-page progress "Czytam PDF… strona X / Y" (`PdfLessonInput.tsx:166`); `no_text` message at `:30`; truncation notice at `:134`; "nothing is uploaded" comment at `:37`.
- Tests: `src/lib/pdf/extract.test.ts` (no_text, page cap, too_large, password, invalid, truncation) with fixture builder `src/lib/pdf/test-pdf.ts`.

### 2. Text → server → AI (current contract)

- `LessonGenerator.tsx:201` POSTs `{ text }` to `/api/ai/proposals`; the UI shows a client-side elapsed counter "Generuję… N s" (`:142-156`, `:479`); there is no streaming.
- Route order in `src/pages/api/ai/proposals.ts`: 401 unauthenticated (`:66`) → 415 non-JSON (`:71`) → 400 when `Content-Length` > 1.2 MB (`:18-20`, `:75`; comment cites the 10 ms CPU budget at `:18`) → zod body (`:22-25`) → 400 unknown model (`:93`) → `validateInput` word/char limits (`:97-105`) → 503 when `OPENROUTER_API_KEY` is missing (`:107`).
- Model resolution: request model → profile model → default Haiku, single call, no fallback chain (`src/lib/services/model-resolution.ts:12-26`).
- OpenRouter call: raw `fetch` to `/api/v1/chat/completions` (`ai-generation.service.ts:6`), `AbortSignal.timeout(60000)` → 504 (`:9`, `:173`), `MAX_TOKENS` 8000 (`:10`), strict `json_schema` response format with `usage.include` (`:159-172`). `StructuredJsonRequest.user` is `string` (`:126`) and `readContent` expects string content (`:93-104`) — no multimodal parts.
- Observability: one `ai_generation` log line per call with status, model, durations, words, token counts; never the lesson text (`proposals.ts:121-160`). No per-user rate limits exist in `src/`.
- `docs/reference/contract-surfaces.md` has no entries for the PDF or generation API (inspected whole file); a plan adding a new body shape should consider adding one.

### 3. Which configured models can read scans, and at what cost

OpenRouter model list (`https://openrouter.ai/api/v1/models`, fetched 2026-11-13), for the three IDs in `src/lib/ai/models.ts:6-8`:

| Model                                | input_modalities                | Prompt $/M tokens | Completion $/M tokens |
| ------------------------------------ | ------------------------------- | ----------------- | --------------------- |
| anthropic/claude-haiku-5.5 (default) | text, image, file               | 0.10              | 0.50                  |
| openai/gpt-6-luna                    | file, image, text               | 0.10              | 0.50                  |
| google/gemini-3.8-flash              | text, image, video, file, audio | 0.825             | 4.125                 |

Tokens per page image (documented by providers, reported by the external-research worker): Gemini 3 ≈ 280 / 560 / 1,120 tokens per image at low / medium / high resolution, medium recommended for document OCR (https://aistudio.google.com/docs/media-resolution); Claude ≈ width×height/750 tokens capped near 1.15 MP (from memory of Anthropic docs, **not re-verified**); OpenAI patch-based for newer models, unknown multiplier for `gpt-6-luna` (**not verified**).

Cost estimate for one 10-page lesson at 150 dpi (inference, using the prices above): ~15–16k image input tokens + ~3–6k transcription output tokens → roughly $0.004–0.005 on Haiku 5.5, about the same order on GPT-6 Luna (token count per image unverified), and ~$0.03–0.04 on Gemini 3.8 Flash at high resolution (less at medium). For comparison, the text-only generation measured $0.0019–0.0105 per lesson (`context/archive/2026-11-03-openrouter-generation-spike/measurements.md:3-17`).

### 4. Options for reading scanned pages

| Option                                                                                     | 10-page latency                                                      | Cost / lesson                      | What leaves the device                                 | Quality                                                             | Fit                                                                                 |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A. Browser renders JPEG pages → vision model (configured model) → text → existing pipeline | ~5–20 s for the vision call + existing generation 14–32 s (estimate) | ~$0.005–0.04 + existing generation | Page images (1–3.3 MB base64) via Worker to OpenRouter | Very good on clean print; small risk of the model "correcting" text | Reuses limits, truncation, review; two AI calls                                     |
| B. Same as A but one call: images + "generate proposals"                                   | ~15–35 s (estimate)                                                  | slightly lower                     | Page images                                            | Same                                                                | One call; bypasses the word-limit/truncation step and changes the generation prompt |
| C. tesseract.js in the browser                                                             | 10–30 s laptop, 40–100 s phone (estimate)                            | $0                                 | Only text                                              | Good on clean print, weak on tables; ~6 MB first download           | No server change; phone latency risk                                                |
| D. OpenRouter `file` part + `mistral-ocr` engine                                           | parsing + LLM                                                        | $2 / 1,000 pages + LLM             | Whole PDF (1–10 MB)                                    | Best for structure/tables                                           | PDF leaves the device; parser retention not covered by ZDR docs                     |
| E. OpenRouter `cloudflare-ai` / Workers AI `toMarkdown`                                    | fast                                                                 | free                               | PDF                                                    | **No OCR — empty output on scans**                                  | Not usable                                                                          |

Sources: OpenRouter PDF engines and pricing https://openrouter.ai/docs/features/multimodal/pdfs; image parts https://openrouter.ai/docs/guides/overview/multimodal/image-understanding; Workers AI markdown conversion https://developers.cloudflare.com/workers-ai/features/markdown-conversion/how-it-works/; tesseract.js 7.0.0 (eng `best_int` model 2.95 MB) https://github.com/naptha/tesseract.js. Latency and quality figures in the table are estimates by the research worker, not measurements.

Other in-browser OCR: Scribe.js is AGPL-3.0 (licensing risk) and ~47 MB unpacked; PaddleOCR via ONNX is MIT but less established, with ~10–20 MB of models (estimates).

### 5. Request size and Cloudflare Workers limits

- Platform (https://developers.cloudflare.com/workers/platform/limits/): request body 100 MB (Free/Pro zone), CPU per request 10 ms Free / 30 s default Paid, no wall-clock limit while the client is connected, 50 subrequests Free, 128 MB memory.
- App: the proposals route rejects bodies over 1.2 MB (`proposals.ts:20`, `:75`). Ten page JPEGs at 150 dpi grayscale, quality ~0.7–0.8, are estimated at 100–250 KB each → 1–2.5 MB raw, 1.3–3.3 MB base64 — above the current cap.
- CPU: production is on the Free plan (`infrastructure.md:17`). JSON-parsing and re-serializing a 1–3 MB body is the CPU-heavy step; it was **not measured** against 10 ms. Lowering resolution (e.g. ~1,000 px long side), sending pages in several smaller requests, or streaming the body through without re-serializing are plan-level choices; the Paid plan ($5/month) is the documented fallback.

### 6. "PDF is not retained" and privacy

- Rule: "An uploaded PDF is not retained after the proposals are generated; only the flashcards remain." (`context/foundation/prd.md:128`); repeated in the roadmap S-10 outcome. Today it is enforced by architecture: the PDF is read in the browser and only text is sent (`PdfLessonInput.tsx:37`).
- Options A/B/C keep the PDF file on the device; A/B send rendered page images that Lexio does not store. Option D sends the PDF itself.
- OpenRouter does not store prompts by default (https://openrouter.ai/docs/guides/privacy/data-collection); `provider.zdr: true` can enforce zero-retention endpoints but removes first-party endpoints (Anthropic via Bedrock/Vertex only, OpenAI via Azure only, Google AI Studio removed) (https://openrouter.ai/docs/features/zdr). ZDR docs do not cover the PDF parser engines.

## Code References

- `src/lib/pdf/extract.ts:10-16` — PDF size/page/min-word limits
- `src/lib/pdf/extract.ts:22-33` — `PdfJsModule` interface (text only, no render)
- `src/lib/pdf/extract.ts:62-94` — extraction flow and `no_text` branch
- `src/lib/pdf/browser.ts:9-19` — lazy pdf.js loader and worker setup
- `src/components/lesson/PdfLessonInput.tsx:30` — current scanned-PDF message
- `src/components/lesson/LessonGenerator.tsx:201` — POST `{ text }` to the proposals route
- `src/pages/api/ai/proposals.ts:18-25`, `:75` — body cap and zod schema
- `src/lib/services/ai-generation.service.ts:126`, `:161-173`, `:221` — text-only message shape, timeout, user prompt
- `src/lib/ai/models.ts:6-8` — the three configured models
- `src/lib/services/model-resolution.ts:12-26` — model selection

## Architecture Insights

- The S-02 split (browser reads the file, Worker only sees text) exists because of the 10 ms CPU limit and the non-Node runtime (`infrastructure.md:71-72`, `:101`). A scanned-page path that keeps OCR/vision input preparation in the browser and the API key on the server follows the same split.
- Converting pages to text first (option A) keeps every downstream rule intact: the 2,000-word limit and truncation notice, CEFR "too easy" grouping, the one-word-per-user rule, rejection reasons and `ai_generation` logging all operate on text.
- `StructuredJsonRequest` is shared with the word-fill route (`ai-generation.service.ts:258`), so widening `user` to multimodal content affects both callers.

## Historical Context (from prior changes)

- `context/archive/2026-11-11-pdf-lesson-generation/plan.md:34` — S-02 excluded OCR as a PRD non-goal at the time (supported then; superseded by PRD v5 FR-017).
- `context/archive/2026-11-11-pdf-lesson-generation/change.md:14` — real PDFs are image-only jsPDF exports; proposed follow-up "render pages in the browser and send them to the vision-capable AI model", needing its own plan, PRD change and cost/60 s measurement (PRD change done in v5; plan and measurement still open).
- `context/archive/2026-11-11-pdf-lesson-generation/change.md:15` — `MIN_TEXT_WORDS` 20 because image-only exports carried one run-together label (still current, `extract.ts:16`).
- `context/archive/2026-11-11-pdf-lesson-generation/plan-brief.md:22` — pdfjs-dist 6.5 legacy build chosen for iOS/Chrome compatibility; unpdf rejected (no Web Worker).
- `context/archive/2026-11-03-openrouter-generation-spike/measurements.md:3-17`, `:37-38` — text generation 13.9–31.9 s for ~2,000 words; streaming judged unnecessary because all models finished well under 60 s. Adding a vision step reduces that margin.
- `context/foundation/infrastructure.md:73` — mobile screen lock can cancel a long request; a two-call flow lengthens the exposure.

## Related Research

- `context/archive/2026-11-03-openrouter-generation-spike/measurements.md` — model latency and cost baseline.
- No earlier `research.md` exists for PDF reading.

## Open Questions

1. **Product (PRD Open Question 1):** does the < 60 s target apply to scanned PDFs? With option A the expected total is the vision call (~5–20 s, estimate) plus the measured 14–32 s generation; a separate target or a lower page limit for scans may be needed. — user decision.
2. **Product (PRD Open Question 2):** what to show when a page can't be read — e.g. the vision step returns nothing or flags low confidence for a page. Option A makes the extracted text visible before generation, which could let the user see what was read. — user decision.
3. **Measurement gap:** actual latency, token usage and transcription quality of the three models on the author's real scanned lessons (no sample PDFs are in the repo). Needed before choosing the default vision model.
4. **Measurement gap:** Worker CPU time for receiving and forwarding a 1–3 MB image body on the Free plan (10 ms).
5. **Plan choice:** one combined call (B) vs vision-to-text then the existing generation (A); page image size/resolution; whether to try the text layer first and fall back to images only when `no_text`.
6. **Unverified:** image token accounting for `openai/gpt-6-luna` and the exact Claude formula for Haiku 5.5.
