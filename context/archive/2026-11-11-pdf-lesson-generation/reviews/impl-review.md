<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: PDF Lesson Generation

- **Plan**: context/changes/pdf-lesson-generation/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 5 observations

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

- **Passed:** `npm test` (109), `npm run lint`, `npx astro check` (0 errors), `npm run build`, `npm run check:client-only` (no pdf.js in 38 server files).
- **CI:** green on `master` at `71e350c`.
- **Manual checks:** all ticked after user confirmation.

Plan adherence: every planned change matches. The disclosed adaptations are judged harmless:

- `MIN_TEXT_WORDS` and the odd/even footer rule, both user-approved.
- An extra `result` prop on the PDF panel.
- `check-client-only` skips Astro manifest path strings.
- The `pdfjs-min.d.ts` type shim.
- `tagFromFileName` as a pure function.
- The 20 MB check before pdf.js loads.

Verified against the build:

- pdf.js is lazy on the client; it is a separate chunk loaded through a dynamic import.
- The SSR guard removes the whole server-side read path.
- `check-client-only` would still catch real pdf.js code (`GlobalWorkerOptions`).
- The client `process` polyfill does not make pdf.js think it runs in Node.
- Nothing from the PDF is uploaded or logged.

## Findings

### F1 — The odd/even footer rule can drop real lines in 5–6 page PDFs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/pdf/lesson-text.ts:66-74
- **Detail**:
  - The parity sets apply the 60% threshold to sets of only 3 pages, and the matching lines are then removed from every page.
  - In a 5-page PDF, a line on 2 odd pages (40% of the document) counts as repeated. So `[["Exercise 1","Read the dialogue."],["b"],["Exercise 2","Read the dialogue."],["d"],["e"]]` loses both exercise headings and the instruction.
  - The digit-stripped key makes numbered headings merge.
  - The existing "2 of 5 pages stays" test puts the line on pages of different parity, so it misses this case.
- **Fix**: Require at least 4 pages in each parity set (an 8+ page PDF) and a line on all but at most one page of the set. Add a test with a line on two same-parity pages of a 5-page PDF.
- **Decision**: FIXED — parity sets need ≥4 pages and the line on all but one of them; 3 tests (5-page same-parity, half of odd pages, 8-page alternating footer)

### F2 — The truncation notice shows the word limit even when the character cap applied

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/lesson/PdfLessonInput.tsx:128-130
- **Detail**: `truncated` is also true when only the 30,000-character cap applied, for example run-together text without spaces. The UI then says "Użyto pierwszych 2000 z N słów" with N ≤ 2000 (e.g. "first 2000 of 1500 words").
- **Fix**: Show the number of words actually kept (`countWords(result.text)`) instead of the constant.
- **Decision**: FIXED — the notice shows the number of words actually kept (countWords(result.text))

### F3 — A failed second pick throws away the previous good PDF

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/lesson/PdfLessonInput.tsx:51
- **Detail**: `onText(null)` runs as soon as a new pick starts. If the user clicks "Zmień plik" and picks a scan or a locked file, the previously loaded lesson text is gone.
- **Fix**: Accept as designed (the user re-picks the good file), or clear the old result only on success.
- **Decision**: FIXED — a failed new pick restores the previously loaded file (Generuj stays off while reading)

### F4 — After a network failure, "Spróbuj ponownie" may keep failing until a reload

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/pdf/browser.ts:13-16; src/components/lesson/PdfLessonInput.tsx:87
- **Detail**: Our loader does not cache a failed load, but browsers have historically cached failed dynamic `import()` of a module URL (whatwg/html#6768), so a retry may fail until the page is reloaded. Current browser behaviour is unverified.
- **Fix**: Change the failure text to "Nie udało się odczytać PDF. Odśwież stronę i spróbuj ponownie."
- **Decision**: FIXED — failure message now says "Odśwież stronę i spróbuj ponownie."

### F5 — `tagFromFileName` can cut an emoji in half

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/pdf/lesson-text.ts:132
- **Detail**: `.slice(0, 50)` counts UTF-16 units, so an emoji straddling the 50th character leaves a lone surrogate in the tag. Whether the database rejects it is unverified. Unlikely for lesson file names.
- **Fix**: Cut by code points (`Array.from(name).slice(0, max).join("")`).
- **Decision**: FIXED — whole code points kept while the UTF-16 length fits 50 (the server zod max counts UTF-16), + test

### F6 — The tabs lack arrow-key navigation

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/lesson/LessonGenerator.tsx:364-389
- **Detail**:
  - The roles and `aria-selected`/`aria-controls` are correct, but there's no roving `tabIndex` or arrow keys (the WAI-ARIA tabs pattern). Both tabs are still reachable with Tab.
  - The progress `role="status"` is mounted only when reading starts, so some screen readers may miss the first update.
- **Fix**: Accept for the MVP; the tabs are usable.
- **Decision**: ACCEPTED — tabs usable with Tab; arrow keys not needed for the MVP

### F7 — Text-rule edge cases: number-only lines and punctuation-only prefixes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/pdf/lesson-text.ts:31, 117-118
- **Detail**:
  - `PAGE_NUMBER_LINE` drops any number-only line (e.g. a year "2015") even in short PDFs.
  - Over 30,000 characters of punctuation before the first word would leave 0 words after truncation.
  - Neither affects vocabulary output in a real lesson PDF.
- **Fix**: Accept; no change.
- **Decision**: ACCEPTED — no effect on vocabulary output in real lesson PDFs
