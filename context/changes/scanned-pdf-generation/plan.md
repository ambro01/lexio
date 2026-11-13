# Scanned PDF Generation Implementation Plan

## Overview

Roadmap slice S-10 (US-01, FR-017). When a lesson PDF has no text layer (scanned or image-only pages), the browser renders its pages to JPEG and sends them **one page per request** to a new endpoint. The endpoint asks the user's AI model to transcribe the page. The browser joins the page texts and feeds the result into the existing PDF flow. From there the existing `POST /api/ai/proposals` generation and review run unchanged. The PDF file never leaves the device.

## Current State Analysis

- A PDF whose extracted text has fewer than 20 words fails with `no_text` (`src/lib/pdf/extract.ts:16`, `:84-86`). The UI then says "Ten PDF nie ma warstwy tekstowej (np. skan). Wklej tekst w zakładce Tekst." (`src/components/lesson/PdfLessonInput.tsx:29`).
- 3 of 4 real lessons are image-only exports, and their text cannot be copied either (`context/archive/2026-11-11-pdf-lesson-generation/change.md:14`). `lesson.pdf` in the repo root is one of them: 7 pages, each one embedded image, 0 words.
- pdf.js is loaded only in the browser (`src/lib/pdf/browser.ts:9-19`). `PdfJsModule` exposes only `getTextContent`, with no rendering (`extract.ts:22-33`).
- The AI service is text-only: `StructuredJsonRequest.user: string` (`src/lib/services/ai-generation.service.ts:126`), and messages are `{role, content: string}` (`:161-164`). The same `requestStructuredJson` also serves the word-fill feature (`:250-268`).
- The proposals route caps the body at 1.2 MB and accepts only `{ text, model? }` (`src/pages/api/ai/proposals.ts:18-25`, `:75`).
- Production runs on the Cloudflare Workers Free plan: 10 ms CPU per request (`context/foundation/infrastructure.md:17`, `:71`).
- Measured on `lesson.pdf` (`research.md`, "Follow-up 2026-11-13"):
  - 7 pages at 1240 px wide JPEG come to 109–148 KB per page.
  - Haiku 5.5 and GPT-6 Luna transcribed all 7 pages in about 6 s for about $0.004, with word-for-word accuracy.
  - Gemini 3.8 Flash cost about $0.021 and leaked QR text.
  - The lesson came to about 220 words per page.

## Desired End State

On "Nowa lekcja" → PDF, the learner picks a scanned or image-only lesson PDF. The panel shows "Odczytuję skan… strona X / Y" while pages are read. It then shows the file name and word count, a note on how many pages were read, and the numbers of any unreadable pages. Generuj leads to the usual proposal review.

From picking the file to seeing proposals, a lesson of up to ~10 pages takes under 60 s (same NFR as text PDFs). If no page can be read, the user sees a clear message and nothing is generated. A network or server failure shows a retryable error. The PDF file is never uploaded; page images exist only in memory during the request and are not stored or logged.

Verify with unit tests for the service, the page-text contract and the scan orchestration. Then run `lesson.pdf` through the deployed app on a phone and check Workers logs for CPU errors.

### Key Discoveries:

- `requestStructuredJson` (`ai-generation.service.ts:145-213`) already owns the timeout, error typing and usage. Widening `user` to accept content parts adds images without a second HTTP client.
- `src/lib/ai/word-fill.ts` is the pattern for an AI contract module: prompt, strict JSON schema, parser and zod input schema, all pure, with no `astro:*` imports.
- `src/pages/api/ai/word-fill.ts` is the pattern for a small AI route: 401 → 415 → `Content-Length` cap → zod → profile model → 503 → one structured log line without user content.
- `lesson-text.ts` already has `dropRepeatedLines`, `toLessonText` and `truncateToLimit`. Transcribed pages reuse them, which strips the repeated page headers Haiku kept ("INTERMEDIATE (B1-B2) / HABITS").
- `PdfLessonInput` already guards stale picks with `pickId`, keeps the previous file on failure and shows per-page progress. The scan path extends the same state machine.

## What We're NOT Doing

- No change to `POST /api/ai/proposals`, the generation prompt, the review flow, the database or the outcome records.
- No single call from images to proposals, and no per-page proposal generation. Pages are transcribed, then generated once (user decision).
- No special treatment of teacher highlights or bold text. They are transcribed as text, with no prioritisation in generation (user decision).
- No preview or editing of the transcribed text.
- No OCR library in the browser (tesseract.js etc.) and no OpenRouter PDF engines (`mistral-ocr`, `cloudflare-ai`).
- No move to the Workers Paid plan. If a page request exceeds 10 ms CPU, the only remedy is smaller images (user decision). If that is not enough, the feature is blocked pending a new decision.
- No mixed PDFs: a PDF with at least 20 words of text uses the text path, and its image-only pages are not transcribed.
- No phone photos or handwriting (PRD Non-Goal). No rate limiting or per-user quotas. No retries of failed page requests beyond the user's "Spróbuj ponownie".
- No storing or logging of page images or transcribed text.

## Implementation Approach

Keep the S-02 split: the browser does all file work (pdf.js render to JPEG), the Worker only forwards one small image to OpenRouter with the server-side key, and text is the only thing that flows into generation.

Small per-page requests (about 200 KB of base64) keep each Worker invocation's JSON parse and re-serialise far below the 10 ms CPU budget. They also give per-page progress and a natural per-page "unreadable" signal.

The page-text model call uses a strict JSON schema `{ text, unreadable }`, so the model reports an unreadable page explicitly instead of returning garbage. The browser joins page texts in page order, applies the existing cleanup and truncation, and hands the result to the existing `onText` contract. Everything after that is S-02 unchanged.

## Critical Implementation Details

- **Timing & lifecycle:** run 3 page requests concurrently, but join results in page order. Stop starting new pages once the transcribed text already exceeds `MAX_INPUT_WORDS` (2,000) or `MAX_SCAN_PAGES` (15) pages have been started; requests already in flight still finish. Every page canvas is released (width/height set to 0) after encoding, so phones do not hold 15 bitmaps.
- **pdf.js 6 render API:** `page.render` takes `{ canvas, canvasContext, viewport }` (the measurement script used this form, `research.md` follow-up). Confirm against the installed 6.5.438 types when extending `PdfJsModule`; the canvas is created in the browser module, never in `extract.ts`, which Vitest runs in Node.
- **Debug & observability:** the CPU risk can only be seen in production. Phase 3 checks Workers logs for `page_text` lines and any `exceededCpu`/1102 outcomes while reading `lesson.pdf`.

## Phase 1: Page transcription endpoint

### Overview

The server can turn one page image into text with the user's AI model. Nothing in the UI uses it yet.

### Changes Required:

#### 1. Page-text contract

**File**: `src/lib/ai/page-text.ts` (new) and `src/lib/ai/page-text.test.ts` (new)

**Intent**: Define the page transcription contract in one pure module, following `word-fill.ts`, so the service, the route and the tests share it.

**Contract**:

- `PAGE_TEXT_SYSTEM_PROMPT`. It tells the model to:
  - transcribe the English lesson text of one worksheet page;
  - include headings, instructions, exercise sentences, vocabulary, grammar notes, and notes the teacher added by hand or typed;
  - skip photos, illustrations, QR codes, logos, page headers and footers, publisher, branding and licence lines, and page numbers;
  - keep the wording, without correcting or translating;
  - set `unreadable: true` when the page has lesson text that cannot be read (blurred, skewed, very low contrast), or when it has no lesson text at all.
- `PAGE_TEXT_JSON_SCHEMA`: strict `{ text: string, unreadable: boolean }`, both required, no additional properties.
- `parsePageText(raw): { text: string; unreadable: boolean }`. The text is trimmed. A non-object or wrong types throw `InvalidModelOutputError`. An empty text counts as unreadable.
- `pageImageSchema`: a zod object `{ image: string }`. `image` must start with `data:image/jpeg;base64,` and is at most `MAX_PAGE_IMAGE_CHARS` = 600,000 chars (about 450 KB JPEG, roughly 3× the measured page size).
- Tests: the parser (valid, wrong types, empty text → unreadable) and the input schema (prefix, length cap).

#### 2. Multimodal request and `transcribePage`

**File**: `src/lib/services/ai-generation.service.ts`, `src/lib/services/ai-generation.service.test.ts`

**Intent**: Let `requestStructuredJson` send a user message made of a text part plus an image part. Then add `transcribePage`, which reads one page with the resolved model. Word-fill and proposal generation keep sending plain strings.

**Contract**:

- `StructuredJsonRequest.user: string | ContentPart[]`, where `ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }`.
- `transcribePage({ image, model, apiKey, fetchImpl?, timeoutMs? }): Promise<{ text; unreadable; model; durationMs; usage }>`. It sends:
  - `PAGE_TEXT_SYSTEM_PROMPT` as the system message;
  - a user message of `[{type:"text", text:"Transcribe this lesson page."}, {type:"image_url", image_url:{url:image}}]`;
  - schema name `page_text` with `PAGE_TEXT_JSON_SCHEMA`;
  - `maxTokens` 3000 (a page is about 500 output tokens; the headroom covers reasoning-token counting, as in `WORD_FILL_MAX_TOKENS`).
- Tests (stub `fetchImpl`, existing pattern):
  - the request body carries the image part and the `page_text` schema;
  - `unreadable` is passed through;
  - HTTP 500 → `UpstreamError`;
  - a timeout → `UpstreamTimeoutError`;
  - existing `generateProposals`/`fillWord` tests still send string content.

#### 3. Route `POST /api/ai/page-text`

**File**: `src/pages/api/ai/page-text.ts` (new)

**Intent**: An authenticated endpoint that transcribes one page image. Same guard order and error shapes as `word-fill.ts`.

**Contract**:

- Guards, in order:
  - 401 when not signed in;
  - 415 when not JSON;
  - 400 when `Content-Length` > 640,000 (the image cap plus JSON overhead);
  - 400 `bad_request` on zod failure;
  - model resolved with `resolveProfileModel(client)` (profile model or the default; no `model` field in the body);
  - 503 `not_configured` when the key or the client is missing.
- 200 `{ text, unreadable, meta: { model, durationMs, usage } }`. The upstream timeout returns 504 `timeout`; `UpstreamError`/`InvalidModelOutputError` return 502 `upstream`. Polish messages follow `proposals.ts`.
- One log line per call, `{ event: "page_text", status, model, modelSource, profileLookup, durationMs, imageChars, words, unreadable, promptTokens, completionTokens }`. It never includes the image or the text.

#### 4. Housekeeping

**File**: `.gitignore`, `docs/reference/contract-surfaces.md`

**Intent**:

- Keep the licensed sample `lesson.pdf` out of git.
- Record the new route as a contract surface, because the browser and the Worker deploy together but tests exercise both sides separately.

**Contract**:

- `.gitignore` gains `lesson.pdf` (the repo-root sample) under a "local samples" comment.
- `contract-surfaces.md` gains a row for `POST /api/ai/page-text`, listing its request/response shape and its consumer (`src/lib/pdf/scan.ts`).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes and pdf.js stays out of the Worker bundle: `npm run build && npm run check:client-only`

#### Manual Verification:

- With `astro dev` running and signed in, posting one rendered page of `lesson.pdf` as a data URL to `/api/ai/page-text` (e.g. from the browser console) returns the page text with `unreadable: false`. A blank white JPEG returns `unreadable: true`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Scanned-PDF path in the browser

### Overview

Picking an image-only PDF on the PDF tab reads its pages through the endpoint and yields lesson text for the existing Generuj flow.

### Changes Required:

#### 1. Page rendering

**File**: `src/lib/pdf/extract.ts`, `src/lib/pdf/render.ts` (new)

**Intent**:

- Extend `PdfJsModule`'s page type with the viewport/render members that rendering needs.
- Add a browser-only renderer that turns one page into a JPEG data URL.

**Contract**:

- In `extract.ts`, the page type gains `getViewport({ scale })` → `{ width, height }` and `render({ canvas, canvasContext, viewport })` → `{ promise }`. `extractLessonText` is unchanged.
- `render.ts` exports `renderPageJpeg(page): Promise<string>`. It:
  - scales the page so its width is `PAGE_IMAGE_WIDTH` = 1240 px;
  - draws it on a fresh `<canvas>` with a white background;
  - encodes it with `canvas.toDataURL("image/jpeg", PAGE_IMAGE_QUALITY = 0.75)`;
  - releases the canvas.
- Smaller images are the agreed CPU remedy, so these two constants are the single knob to turn. `render.ts` is imported only dynamically from the browser, like `browser.ts`.

#### 2. Scan orchestration

**File**: `src/lib/pdf/scan.ts` (new), `src/lib/pdf/scan.test.ts` (new)

**Intent**: Read an image-only PDF page by page. Render each page, send it to the endpoint with limited concurrency, then join and clean the texts in page order. The dependencies are injected, so Vitest can test the logic in Node without a canvas or a network.

**Contract**:

- `readScannedLesson(pdfjs, data, { renderPage, transcribe, onProgress? }): Promise<ScanResult>`.
  - `renderPage(page) → Promise<string>` is the data URL.
  - `transcribe(image) → Promise<{ ok: true; text: string; unreadable: boolean } | { ok: false; message: string }>`.
  - `onProgress(done, total)` reports progress.
- Success: `{ ok: true; text; totalWords; truncated; pages; pagesRead; unreadablePages: number[] }`. `unreadablePages` holds 1-based page numbers.
- Failures: `{ ok: false; reason: "unreadable" }` when no page yields text, or when the joined text is under `MIN_TEXT_WORDS`. `{ ok: false; reason: "request"; message }` on the first transcription failure: in-flight results are ignored and no new pages start. `"password" | "invalid" | "failed"` as in `extract.ts`.
- Limits:
  - `SCAN_CONCURRENCY` = 3.
  - `MAX_SCAN_PAGES` = 15.
  - Stop starting new pages once the joined text exceeds `MAX_INPUT_WORDS`.
  - Then `dropRepeatedLines` → `toLessonText` → `truncateToLimit` (`lesson-text.ts`), with each page's text split into lines.
- `total` in `onProgress` is the number of pages that will be attempted, `min(numPages, MAX_SCAN_PAGES)`. Progress counts finished pages.
- Tests use a fake `PdfJsModule` and fake `renderPage`/`transcribe`:
  - text is joined in page order even when transcriptions finish out of order;
  - unreadable pages are skipped and reported;
  - all pages unreadable → `unreadable`;
  - one failed request → `request`, and no further pages start;
  - no new pages start after the word limit is reached;
  - the 15-page cap holds;
  - concurrency never exceeds 3;
  - repeated headers are dropped;
  - the result is truncated to 2,000 words.

#### 3. PDF tab integration

**File**: `src/components/lesson/PdfLessonInput.tsx`

**Intent**: When text extraction returns `no_text`, switch automatically to the scan path. Show its progress, then report the result through the same `onText` contract, so `LessonGenerator` and generation stay unchanged.

**Contract**:

- On `no_text`:
  - re-read the file bytes (pdf.js detached the previous buffer);
  - lazily import `scan.ts` and `render.ts`;
  - run `readScannedLesson`, with `transcribe` POSTing `{ image }` to `/api/ai/page-text` and mapping non-2xx bodies to their `message` (same handling as `postJson` in `LessonGenerator.tsx:57-88`).
- Status gains `{ name: "scanning"; page; pages }`, shown as "Odczytuję skan… strona X / Y". The file input and "Zmień plik" stay disabled during scanning, as during reading. The existing `pickId` guard also covers the scan.
- `PdfText` gains an optional `scan?: { pagesRead: number; pages: number; unreadablePages: number[] }`. The result row adds:
  - "Odczytano skan: N z M stron", where M is the total page count, so a lesson longer than 15 pages shows it was cut;
  - "Nie udało się odczytać stron: 3, 5" in amber when there are unreadable pages.
- Failure messages:
  - `unreadable` → "Nie udało się odczytać tekstu z tego skanu."
  - `request` → the server's message, or "Nie udało się odczytać skanu. Spróbuj ponownie." The previous file is kept, as today.
  - The `no_text` message ("…Wklej tekst w zakładce Tekst.") no longer appears on this path.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes and pdf.js stays out of the Worker bundle: `npm run build && npm run check:client-only`

#### Manual Verification:

- In `astro dev` on desktop, picking `lesson.pdf` shows "Odczytuję skan… strona X / 7". The panel then shows "Odczytano skan: 7 z 7 stron" with about 1,500 words. Generuj returns proposals from the lesson (e.g. "kick the habit", "creature of habit"), with no linguahouse/Expemo/QR words.
- A PDF with a text layer still uses the text path, unchanged.
- With the dev server stopped mid-scan, the panel shows a retryable error and keeps the previously loaded file.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Docs and production check

### Overview

The PRD, README and agent docs reflect the scan path, and the deployed app is checked on a phone, including Worker CPU.

### Changes Required:

#### 1. PRD

**File**: `context/foundation/prd.md`

**Intent**: Resolve PRD Open Questions 1 and 2 with the user's decisions and move them to the "Resolved earlier" line.

**Contract**:

- Open Question 1 → the < 60 s target applies to scanned PDFs too (up to ~10 pages).
- Open Question 2 → unreadable pages are skipped and named in a message, and a scan with no readable text shows a clear message with no proposals.
- The relevant NFR or business-logic line mentions scanned PDFs. No other PRD change.

#### 2. README and AGENTS

**File**: `README.md`, `AGENTS.md`

**Intent**: Document the new route and the rule that page images are only forwarded, never stored or logged.

**Contract**:

- README: an API route row for `POST /api/ai/page-text`.
- AGENTS.md, in the pdf.js / browser-only notes: `render.ts` is browser-only like `browser.ts`, and page images must never be persisted or logged.

### Success Criteria:

#### Automated Verification:

- Lint, tests and build pass: `npm run lint && npm test && npm run build`
- CI passes on `master` after push.

#### Manual Verification:

- On a phone, against production: `lesson.pdf` → proposals within 60 s from picking the file, with the progress visible throughout.
- Workers logs for that run show 7 `page_text` lines with status 200 and no CPU-limit (1102 / exceeded CPU) errors. If CPU errors appear, lower `PAGE_IMAGE_WIDTH`/`PAGE_IMAGE_QUALITY` and re-check; if that is not enough, stop and escalate (no Paid plan by decision).
- No page image or transcribed text appears in the logs.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `page-text.ts`: parser (types, trimming, empty → unreadable) and input schema (JPEG data-URL prefix, length cap).
- `ai-generation.service.ts`: `transcribePage` request shape (image part, schema, max tokens) and error mapping; existing string-content callers unchanged.
- `scan.ts`:
  - page order with out-of-order completion;
  - unreadable pages;
  - all unreadable;
  - request failure stops further pages;
  - word-limit stop;
  - 15-page cap;
  - concurrency ≤ 3;
  - header cleanup;
  - truncation.

### Integration Tests:

- None automated (no route or e2e test setup exists). The route is covered by manual checks in Phases 1 and 3.

### Manual Testing Steps:

1. Dev: post one page image to `/api/ai/page-text`, then a blank page.
2. Dev: pick `lesson.pdf` on the PDF tab, generate and review.
3. Dev: pick a text PDF (regression).
4. Dev: stop the server mid-scan (error path).
5. Production, phone: `lesson.pdf` end to end under 60 s; then check Workers logs for CPU errors and the absence of content.

## Performance Considerations

- Measured on `lesson.pdf`: about 6 s for the vision transcription of 7 pages in one call. Per-page calls at concurrency 3 should take a similar wall time (inference, not measured). Generation then takes the measured 14–32 s (`context/archive/2026-11-03-openrouter-generation-spike/measurements.md:3-17`).
- Upload is about 200 KB of base64 per page request. 10 pages come to about 2 MB in total, spread over 4 rounds of 3.
- Cost: about $0.004 per 7-page lesson on Haiku 5.5 or GPT-6 Luna (measured, single call); per-page calls repeat the short prompt, so slightly more. Gemini 3.8 Flash costs about 6× more.

## Migration Notes

None: no database or API contract changes for existing routes.

## References

- Research: `context/changes/scanned-pdf-generation/research.md`
- S-02 plan and decisions: `context/archive/2026-11-11-pdf-lesson-generation/plan.md`, `change.md:14-15`
- Patterns: `src/lib/ai/word-fill.ts`, `src/pages/api/ai/word-fill.ts`, `src/lib/pdf/extract.ts`, `src/components/lesson/PdfLessonInput.tsx`
- Model baseline: `context/archive/2026-11-03-openrouter-generation-spike/measurements.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Page transcription endpoint

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 1bf512b
- [x] 1.2 Lint passes: `npm run lint` — 1bf512b
- [x] 1.3 Type check passes: `npx astro check` — 1bf512b
- [x] 1.4 Build passes and pdf.js stays out of the Worker bundle: `npm run build && npm run check:client-only` — 1bf512b

#### Manual

- [x] 1.5 Dev endpoint returns page text for a `lesson.pdf` page and `unreadable: true` for a blank page — 1bf512b

### Phase 2: Scanned-PDF path in the browser

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 07d5f5a
- [x] 2.2 Lint passes: `npm run lint` — 07d5f5a
- [x] 2.3 Type check passes: `npx astro check` — 07d5f5a
- [x] 2.4 Build passes and pdf.js stays out of the Worker bundle: `npm run build && npm run check:client-only` — 07d5f5a

#### Manual

- [x] 2.5 Dev: `lesson.pdf` shows scan progress, 7 of 7 pages read, and proposals without boilerplate words — 07d5f5a
- [x] 2.6 Dev: a PDF with a text layer still uses the text path — 07d5f5a
- [x] 2.7 Dev: a server failure mid-scan shows a retryable error and keeps the previous file — 07d5f5a

### Phase 3: Docs and production check

#### Automated

- [x] 3.1 Lint, tests and build pass: `npm run lint && npm test && npm run build` — da4973e
- [x] 3.2 CI passes on `master` after push — da4973e

#### Manual

- [x] 3.3 Phone, production: `lesson.pdf` → proposals within 60 s with visible progress — da4973e
- [x] 3.4 Workers logs: 7 `page_text` lines with status 200 and no CPU-limit errors — da4973e
- [x] 3.5 Workers logs contain no page image or transcribed text — da4973e
