import { countWords } from "@/lib/ai/proposals";
import {
  type TextContentItem,
  dropRepeatedLines,
  pageLines,
  toLessonText,
  truncateToLimit,
} from "@/lib/pdf/lesson-text";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;
/**
 * Below this many words the PDF is treated as having no text layer: image-only exports often carry a stray
 * label or two (e.g. one run-together string from a drag-and-drop exercise), which is not lesson text.
 */
export const MIN_TEXT_WORDS = 20;

/** pdf.js `VerbosityLevel.ERRORS`: no warnings in the console. */
const VERBOSITY_ERRORS = 0;

/** The part of the pdf.js module this driver uses; the caller passes the library so it can be lazy-loaded. */
export interface PdfJsModule {
  getDocument(src: { data: Uint8Array; verbosity?: number }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getTextContent(): Promise<{ items: TextContentItem[] }>;
        cleanup(): unknown;
      }>;
    }>;
    destroy(): Promise<void>;
  };
}

export type PdfFailure = "too_large" | "no_text" | "password" | "invalid" | "failed";

export type PdfExtraction =
  | { ok: true; text: string; totalWords: number; truncated: boolean; pages: number; pagesRead: number }
  | { ok: false; reason: PdfFailure };

export interface ExtractOptions {
  /** Called after each page is read, with the 1-based page number and the number of pages that will be read. */
  onProgress?: (page: number, pages: number) => void;
}

/** pdf.js rebuilds errors across the worker boundary, so they are matched by name, not `instanceof`. */
function failureReason(error: unknown): PdfFailure {
  const name = error instanceof Error ? error.name : undefined;
  if (name === "PasswordException") {
    return "password";
  }
  if (name === "InvalidPDFException") {
    return "invalid";
  }
  return "failed";
}

/**
 * Reads the text of up to `MAX_PDF_PAGES` pages, drops repeated headers/footers and page numbers, and truncates it
 * to the generation input limits. `data` is handed to pdf.js and may be detached afterwards.
 */
export async function extractLessonText(
  pdfjs: PdfJsModule,
  data: Uint8Array,
  options: ExtractOptions = {},
): Promise<PdfExtraction> {
  if (data.byteLength > MAX_PDF_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  let loadingTask: ReturnType<PdfJsModule["getDocument"]> | undefined;
  try {
    loadingTask = pdfjs.getDocument({ data, verbosity: VERBOSITY_ERRORS });
    const doc = await loadingTask.promise;
    const pagesRead = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: string[][] = [];
    for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(pageLines(content.items));
      page.cleanup();
      options.onProgress?.(pageNumber, pagesRead);
    }
    const text = toLessonText(dropRepeatedLines(pages));
    if (countWords(text) < MIN_TEXT_WORDS) {
      return { ok: false, reason: "no_text" };
    }
    return { ok: true, ...truncateToLimit(text), pages: doc.numPages, pagesRead };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  } finally {
    // A failed cleanup must not replace the result.
    await loadingTask?.destroy().catch(() => undefined);
  }
}
