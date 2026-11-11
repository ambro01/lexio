# PDF Lesson Generation Implementation Plan

## Overview

Build roadmap slice S-02: on "Nowa lekcja" a signed-in user switches to a **PDF** tab, picks a lesson PDF with a text layer, and gets the same proposal review as S-01. The browser extracts the text with pdf.js, drops repeated headers/footers and page numbers, truncates it to 2,000 words with a visible notice, and sends only the text to the existing generation endpoint. The PDF never leaves the device, so it is not retained by construction.

## Current State Analysis

- **S-01 is live.** `LessonGenerator.tsx` has the form (tag + text area + `n / 2000 słów` counter), generation via `POST /api/ai/proposals` with `{ text }`, the localStorage draft, review and accept (`src/components/lesson/LessonGenerator.tsx:164-170`). Everything after "Generuj" is reused unchanged.
- **The server limits are fixed:** `validateInput` accepts up to `MAX_INPUT_WORDS = 2000` words counted by `countWords` and up to `MAX_INPUT_CHARS = 30000` characters (`src/lib/ai/proposals.ts:21-45`).
- **Where to parse is decided** (`context/foundation/infrastructure.md:17,101`): extract PDF text in the browser with pdf.js; server-side parsing would exceed the Free plan's 10 ms CPU per request.
- **The island is server-rendered** (`src/pages/generate.astro:34`, `client:load`), and the Worker runs with `nodejs_compat` (`wrangler.jsonc:6`). pdf.js detects Node via `process` and may try Node-only paths if evaluated on workerd, so it must never load during SSR.
- No PDF library is installed yet.

## Desired End State

- "Nowa lekcja" shows two tabs, **Tekst** and **PDF**. The Tekst tab is the S-01 form unchanged.
- On the PDF tab the user picks a `.pdf` file and sees a progress line ("Czytam PDF… strona 3 / 10") followed by the file name and word count, or "Użyto pierwszych 2000 z N słów" when the text was truncated. If the tag field is empty, it is prefilled from the file name. "Generuj" then runs the same generation and review as S-01.
- Scanned PDFs (no text layer), password-protected or invalid files, and files over 20 MB show a clear Polish message and do not generate.
- pdf.js (legacy build, about 550 KB gzipped) is downloaded only when the user picks a file and never appears in the server bundle.
- Verification: `npm test` covers the cleanup and truncation rules and runs pdf.js on generated PDFs. A build check shows no pdf.js code in `dist/server`. A real lesson PDF on a phone in production generates proposals within 60 s.

### Key Discoveries:

- **Library:** `pdfjs-dist` 6.5.x (Apache-2.0, Mozilla). The **legacy** build is required: the modern build calls `Map.prototype.getOrInsertComputed` and `Math.sumPrecise` without polyfills, which need iOS 26.2+ / Chrome 147+, so it would break the PRD's "latest two major mobile browser versions". The legacy build targets Safari 18+ and Chrome 125+ for about 20 KB more gzipped. `unpdf` was rejected: it has no separate worker, so parsing would block the UI thread.
- **pdf.js 6 API:** `getDocument({ data })` takes the object form only; cancel with `loadingTask.destroy()`. `page.getTextContent().items` mixes text items (`str`, `hasEOL`) with marked-content items (no `str`). Errors are rebuilt across the worker boundary, so match on `error.name` (`PasswordException`, `InvalidPDFException`), not `instanceof`.
- **No CMaps or standard font data are needed** to extract Latin text.
- **A dynamic `import()` inside a `client:load` component is still compiled into the server bundle as a lazy chunk** unless guarded with `import.meta.env.SSR` (statically removed) or the component is `client:only`.
- Truncation must count words with the server's `countWords` rule and also stay within `MAX_INPUT_CHARS`, or the server could refuse the truncated text.

## What We're NOT Doing

- No server-side PDF parsing, no upload of the PDF anywhere, no storage of the file or its text (only the review draft, as in S-01).
- No OCR for PDFs without a text layer (PRD non-goal); the message points to the Tekst tab.
- No change to the generation or accept endpoints, the database or the outcome records. No `source` (pdf/text) column: the PRD metric is not split by input.
- No preview or editing of the extracted text on the PDF tab (decision: separate tabs that show only the file name and word count).
- No change to pasted text: over 2,000 words is still rejected (Generuj disabled, red counter). Only PDF text is truncated.
- No CEFR grouping (S-03), no known-words filter (S-09), no Screen Wake Lock or rate limiting.
- No support for PDFs larger than 20 MB, and no reading beyond the first 30 pages.

## Implementation Approach

The core work is two modules under `src/lib/pdf/`. A pure module turns per-page text into cleaned, truncated lesson text, so every rule is unit-tested without pdf.js. A thin extraction module drives pdf.js but receives the library as a parameter: the browser passes the lazily-loaded legacy build, and Vitest passes the same build loaded in Node, so real extraction is tested on PDFs generated inside the test. The UI adds a tab and a small PDF panel component to the existing island. It loads pdf.js only inside the file-change handler behind an `import.meta.env.SSR` guard, and hands the resulting text to the existing `generate()` path. Docs and the PRD rule are updated last, together with a production check on a phone.

## Critical Implementation Details

- **Keep pdf.js out of SSR.** No top-level import of `pdfjs-dist`, of the browser loader module, or of `?url` worker imports anywhere reachable from `LessonGenerator.tsx`. The loader is reached only via `await import(...)` inside an event handler that first checks `if (import.meta.env.SSR) return`. Phase 2 adds an automated check that `dist/server` contains no pdf.js code.
- **The buffer is transferred.** `getDocument({ data })` hands the `Uint8Array` to the worker and detaches it. Create it fresh from `file.arrayBuffer()` and do not reuse it.
- **Order of text rules:** join each page's items into lines → drop repeated header/footer lines and page-number-only lines across pages → collapse whitespace → count words → truncate. Truncating before cleanup would waste the 2,000-word budget on headers.

## Phase 1: PDF text extraction core

### Overview

Add `pdfjs-dist`, the pure cleanup and truncation rules, and an extraction module that drives pdf.js and can be tested in Node.

### Changes Required:

#### 1. Dependency

**File**: `package.json`

**Intent**: Add the PDF library.

**Contract**: `pdfjs-dist` `^6.5` in `dependencies` (`npm i pdfjs-dist`). Its optional `@napi-rs/canvas` dependency is not used and needs no configuration.

#### 2. Text rules (pure)

**File**: `src/lib/pdf/lesson-text.ts` (+ `src/lib/pdf/lesson-text.test.ts`)

**Intent**: Turn pdf.js page content into the text sent to the AI: readable lines, no repeated headers/footers or page numbers, within the server's limits.

**Contract**:

- `pageLines(items: Array<{ str?: string; hasEOL?: boolean }>): string[]`: concatenates `str` of text items, breaks a line on `hasEOL`, skips items without `str`, trims each line and drops empty ones.
- `dropRepeatedLines(pages: string[][]): string[][]`: when there are at least 3 pages, removes lines whose whitespace-normalised, case-insensitive, digit-stripped form appears on at least 60% of pages (so "Unit 3 – page 4" and "Unit 3 – page 5" count as the same header), and on any page count removes lines that are only a page number (`^\s*(page|strona)?\s*\d+(\s*(/|of|z)\s*\d+)?\s*$`, case-insensitive). A page that ends up empty stays as an empty page.
- `toLessonText(pages: string[][]): string`: joins lines with `\n` and pages with a blank line, then collapses runs of spaces and tabs and runs of 3+ newlines.
- `truncateToLimit(text: string, maxWords = MAX_INPUT_WORDS, maxChars = MAX_INPUT_CHARS): { text: string; totalWords: number; truncated: boolean }`: `totalWords` is `countWords(text)`. When over either limit, keep the longest prefix ending at a whitespace boundary that has at most `maxWords` words by `countWords` and at most `maxChars` characters. The result must always pass `validateInput` unless the text has no words.

#### 3. Extraction driver

**File**: `src/lib/pdf/extract.ts` (+ `src/lib/pdf/extract.test.ts`, test helper `src/lib/pdf/test-pdf.ts`)

**Intent**: Read a PDF with a given pdf.js module and return lesson text or a typed failure, with progress reporting and hard limits. No browser-only APIs, so it runs in Vitest.

**Contract**:

- `MAX_PDF_BYTES = 20 * 1024 * 1024`, `MAX_PDF_PAGES = 30`.
- `extractLessonText(pdfjs: PdfJsModule, data: Uint8Array, options?: { onProgress?: (page: number, pages: number) => void }): Promise<PdfExtraction>`, where `PdfJsModule` is the minimal structural type of `getDocument` that this module uses.
- `PdfExtraction` = `{ ok: true; text; totalWords; truncated; pages; pagesRead }` or `{ ok: false; reason: "too_large" | "no_text" | "password" | "invalid" | "failed" }`.
- `too_large` is checked on `data.byteLength` before parsing. Only the first `MAX_PDF_PAGES` pages are read. `no_text` when the cleaned text has no words. `password` / `invalid` come from `error.name` (`PasswordException` / `InvalidPDFException`), and anything else is `failed`. The loading task is always destroyed (`finally`).
- Result text comes from `pageLines` → `dropRepeatedLines` → `toLessonText` → `truncateToLimit`.
- `test-pdf.ts` (test-only) builds a minimal valid PDF from `pages: string[][]` (one Helvetica text line per string, a page with no strings gives no text layer), so tests need no binary fixtures. The tests load `pdfjs-dist/legacy/build/pdf.mjs` in Node.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including text-rule and extraction tests on generated PDFs: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Running the extraction on one real lesson PDF in a local script or test gives readable text without repeated headers/footers

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: PDF tab in the lesson form

### Overview

Add the Tekst / PDF tabs and the PDF panel, load pdf.js only on demand in the browser, and guard the server bundle.

### Changes Required:

#### 1. Browser loader

**File**: `src/lib/pdf/browser.ts`

**Intent**: The only place that imports pdf.js for the browser.

**Contract**: `loadPdfjs(): Promise<PdfJsModule>` dynamically imports `pdfjs-dist/legacy/build/pdf.min.mjs` and `pdfjs-dist/legacy/build/pdf.worker.min.mjs?url`, sets `GlobalWorkerOptions.workerSrc`, and caches the module. This file must never be imported statically from a component.

#### 2. PDF panel

**File**: `src/components/lesson/PdfLessonInput.tsx`

**Intent**: The PDF tab: file picker, progress, result summary and errors.

**Contract**:

- Props: `disabled`, `onText(result: { text; totalWords; truncated; fileName } | null)`.
- `<input type="file" accept="application/pdf,.pdf">`. On change: `if (import.meta.env.SSR) return;` then `await import("@/lib/pdf/browser")` and `await import("@/lib/pdf/extract")`, and run `extractLessonText` on `new Uint8Array(await file.arrayBuffer())`.
- Shows "Czytam PDF… strona p / n" while reading, then the file name and "N słów" or "Użyto pierwszych 2000 z N słów", plus "Zmień plik".
- Error messages:
  - `too_large`: "Plik jest za duży (maks. 20 MB)."
  - `no_text`: "Ten PDF nie ma warstwy tekstowej (np. skan). Wklej tekst w zakładce Tekst."
  - `password`: "PDF jest zabezpieczony hasłem."
  - `invalid`: "To nie jest poprawny plik PDF."
  - `failed` or a failed library load: "Nie udało się odczytać PDF. Spróbuj ponownie."
- The file is only read in memory; nothing is uploaded.

#### 3. Tabs in the form

**File**: `src/components/lesson/LessonGenerator.tsx`

**Intent**: Let the user choose Tekst or PDF, and generate from whichever is active.

**Contract**:

- **Tabs:** a two-button tab switch "Tekst" / "PDF" above the input (accessible `role="tablist"`, `aria-selected`). Tekst is the default, and each tab keeps its own state when switching.
- **What gets generated:** the active tab decides the text sent by `generate()`: the text area for Tekst, the extracted text for PDF.
- **Generuj enabled:**
  - Tekst: same rule as today.
  - PDF: a tag is set and extracted text exists.
- **Tag prefill:** when PDF text arrives and the tag field is empty, set the tag from the file name. Remove the `.pdf` extension, replace `_` with a space, collapse whitespace, cut to `MAX_TAG_CHARS`.
- **Unchanged:** errors, the 0-proposals message, the draft, review and accept all behave exactly as in S-01.

#### 4. Server-bundle guard

**File**: `scripts/check-client-only.mjs`, `package.json`, `.github/workflows/ci.yml`

**Intent**: Fail CI if pdf.js leaks into the Worker bundle.

**Contract**: `npm run check:client-only` (run after `npm run build`) exits non-zero when any file under `dist/server` contains `pdfjs-dist`, `GlobalWorkerOptions` or `pdf.worker`, and prints the offending files. The CI `ci` job runs it after the build step. A separate tooling commit is not needed: it is part of this feature's guarantee.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint and type check pass: `npm run lint` and `npx astro check`
- Build passes and pdf.js is absent from the server bundle: `npm run build` and `npm run check:client-only`
- Smoke still passes: `npm run smoke`

#### Manual Verification:

- Locally, picking a lesson PDF shows progress, then the file name and word count; the tag is prefilled from the file name when empty; Generuj produces proposals and the review works as in S-01
- A PDF over 2,000 words shows "Użyto pierwszych 2000 z N słów" and generates
- A scanned PDF, a password-protected PDF and a renamed non-PDF file each show their message and do not generate
- The pdf.js files are downloaded only after picking a file (browser network tab), and the Tekst tab works as before
- The PDF tab is usable at 390 px width

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Docs and production check

### Overview

Bring the PRD and docs in line with the new behaviour, ship, and verify on a phone in production.

### Changes Required:

#### 1. PRD rule

**File**: `context/foundation/prd.md`

**Intent**: Record the decision that PDF text is truncated, not rejected.

**Contract**: The NFR line "Generation accepts input up to 2,000 words … larger input is rejected with a clear message." (`prd.md:123`) becomes: pasted text over 2,000 words is rejected with a clear message, and text extracted from a PDF is cut to its first 2,000 words with a visible notice. Add a dated decision note in the PRD's existing decision style.

#### 2. Docs

**Files**: `README.md`, `AGENTS.md`

**Intent**: Document PDF input and the client-only rule.

**Contract**:

- README: the `/generate` row mentions "paste text or PDF".
- AGENTS.md:
  - A hard rule: pdf.js (`pdfjs-dist`) is browser-only. It is loaded only through `src/lib/pdf/browser.ts` via a dynamic import behind `import.meta.env.SSR`, and `npm run check:client-only` guards it.
  - The new command in the Commands list.

### Success Criteria:

#### Automated Verification:

- CI (lint, test, astro check, build, check:client-only, check:rls, smoke) is green on `master` after the push

#### Manual Verification:

- On the deployed app on a phone, a real lesson PDF generates proposals within 60 s with visible progress, and accepting saves cards with the tag
- Cloudflare observability shows no CPU-limit (1102) errors for those requests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `pageLines`:
  - `hasEOL` breaks lines.
  - Items without `str` are skipped.
  - Empty lines are dropped.
- `dropRepeatedLines`:
  - A header on every page is removed.
  - Headers differing only by page number are removed.
  - "Page 3 of 10" / "Strona 3" / "3" lines are removed.
  - A line repeated on 2 of 5 pages stays.
  - With fewer than 3 pages only page-number lines are removed.
- `truncateToLimit`:
  - Under the limit, the text is unchanged.
  - 2,500 words give exactly 2,000 by `countWords`.
  - Punctuation-only tokens don't count.
  - The character cap is respected for long words.
  - The result always passes `validateInput`.
- `extractLessonText` on generated PDFs:
  - Multi-page text is extracted in order.
  - A repeated header is removed.
  - A long PDF is truncated with the right `totalWords`.
  - A PDF with no text gives `no_text`.
  - Bytes that are not a PDF give `invalid`.
  - Data over 20 MB gives `too_large` without parsing.
  - Only 30 pages are read.
  - Progress is reported per page.

### Integration Tests:

- `npm run check:client-only` in CI: pdf.js never reaches the Worker bundle.

### Manual Testing Steps:

1. Generate from a real lesson PDF locally and on a phone in production; check the word count and the review.
2. Try a scanned PDF, a password-protected PDF and a non-PDF file.
3. Watch the network tab: pdf.js loads only after picking a file.

## Performance Considerations

- pdf.js (about 550 KB gzipped, worker included) is fetched once, on demand, and cached by the browser. Parsing runs in a Web Worker, so the UI stays responsive.
- Reading stops at 30 pages; files over 20 MB are refused before parsing, which protects phone memory.
- No change to Worker CPU: the endpoint receives text exactly as for pasted input.

## Migration Notes

- No database or API changes. Rollback is reverting the code.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd.md` (US-01, FR-002, NFR at line 123, Non-Goals: no OCR)
- Platform decision: `context/foundation/infrastructure.md` (browser-side PDF extraction, risk register)
- S-01 flow reused: `context/archive/2026-11-10-paste-text-generation/plan.md`, `src/components/lesson/LessonGenerator.tsx`
- Input limits: `src/lib/ai/proposals.ts:21-45`
- pdf.js: https://github.com/mozilla/pdf.js (v6.5.438, legacy build targets in `gulpfile.mjs`), https://www.npmjs.com/package/pdfjs-dist
- Lessons: `context/foundation/lessons.md` (no lodash; tooling commits separate from phase commits)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: PDF text extraction core

#### Automated

- [x] 1.1 Unit tests pass, including text-rule and extraction tests on generated PDFs: `npm test`
- [x] 1.2 Lint and type check pass: `npm run lint` and `npx astro check`
- [x] 1.3 Build passes: `npm run build`

#### Manual

- [x] 1.4 Extraction of one real lesson PDF gives readable text without repeated headers/footers

### Phase 2: PDF tab in the lesson form

#### Automated

- [ ] 2.1 Unit tests pass: `npm test`
- [ ] 2.2 Lint and type check pass: `npm run lint` and `npx astro check`
- [ ] 2.3 Build passes and pdf.js is absent from the server bundle: `npm run build` and `npm run check:client-only`
- [ ] 2.4 Smoke still passes: `npm run smoke`

#### Manual

- [ ] 2.5 Local PDF run: progress, file name and word count, tag prefill, generation and review work
- [ ] 2.6 A PDF over 2,000 words shows the truncation notice and generates
- [ ] 2.7 Scanned, password-protected and non-PDF files show their messages and do not generate
- [ ] 2.8 pdf.js downloads only after picking a file; the Tekst tab works as before
- [ ] 2.9 The PDF tab is usable at 390 px width

### Phase 3: Docs and production check

#### Automated

- [ ] 3.1 CI (lint, test, astro check, build, check:client-only, check:rls, smoke) is green on `master` after the push

#### Manual

- [ ] 3.2 A real lesson PDF on a phone in production generates proposals within 60 s and accepting saves the cards
- [ ] 3.3 No CPU-limit (1102) errors in Cloudflare observability for those requests
