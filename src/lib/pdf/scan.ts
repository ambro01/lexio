import { MAX_INPUT_WORDS, countWords } from "@/lib/ai/proposals";
import { MIN_TEXT_WORDS, type PdfJsModule, type PdfPage, failureReason } from "@/lib/pdf/extract";
import { dropRepeatedLines, toLessonText, truncateToLimit } from "@/lib/pdf/lesson-text";

/** Pages rendered and transcribed at the same time. */
export const SCAN_CONCURRENCY = 3;
/** Pages of a scan that are read at most; a longer lesson is cut. */
export const MAX_SCAN_PAGES = 15;

/** pdf.js `VerbosityLevel.ERRORS`: no warnings in the console. */
const VERBOSITY_ERRORS = 0;

export type PageTranscription = { ok: true; text: string; unreadable: boolean } | { ok: false; message: string };

export interface ScanOptions {
  /** Renders a page to an image data URL. */
  renderPage: (page: PdfPage) => Promise<string>;
  /** Reads the text of one page image (the page transcription endpoint). */
  transcribe: (image: string) => Promise<PageTranscription>;
  /** Called with the number of finished pages and the number of pages that will be attempted. */
  onProgress?: (done: number, total: number) => void;
}

export type ScanFailure =
  | { ok: false; reason: "unreadable" | "password" | "invalid" | "failed" }
  | { ok: false; reason: "request"; message: string };

export type ScanResult =
  | {
      ok: true;
      text: string;
      totalWords: number;
      truncated: boolean;
      /** Pages in the PDF. */
      pages: number;
      /** Pages transcribed, readable or not. */
      pagesRead: number;
      /** 1-based numbers of the pages whose text could not be read. */
      unreadablePages: number[];
    }
  | ScanFailure;

/** Splits a page transcription into trimmed, non-empty lines. */
function transcriptionLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * Reads an image-only PDF: renders up to `MAX_SCAN_PAGES` pages and transcribes them, `SCAN_CONCURRENCY` at a time.
 * No new page starts once the text read so far exceeds `MAX_INPUT_WORDS`, or after the first failed transcription
 * (whose result is returned at once; requests in flight are ignored). Texts are joined in page order, repeated
 * headers/footers are dropped and the text is truncated to the generation input limits. `data` is handed to pdf.js
 * and may be detached afterwards.
 */
export async function readScannedLesson(
  pdfjs: PdfJsModule,
  data: Uint8Array,
  options: ScanOptions,
): Promise<ScanResult> {
  let loadingTask: ReturnType<PdfJsModule["getDocument"]> | undefined;
  try {
    loadingTask = pdfjs.getDocument({ data, verbosity: VERBOSITY_ERRORS });
    const doc = await loadingTask.promise;
    const total = Math.min(doc.numPages, MAX_SCAN_PAGES);
    options.onProgress?.(0, total);

    // Index = page number - 1; `null` marks an unreadable page, `undefined` a page not finished.
    const texts: (string[] | null | undefined)[] = [];
    let nextPage = 1;
    let done = 0;
    let words = 0;
    let failure: ScanFailure | undefined;
    let signalFailure: () => void = () => undefined;
    const failed = new Promise<void>((resolve) => {
      signalFailure = resolve;
    });
    // A function, not the variable, so TypeScript does not keep the loop condition's narrowing across awaits.
    const stopped = () => failure !== undefined;
    const fail = (result: ScanFailure) => {
      if (!failure) {
        failure = result;
        signalFailure();
      }
    };

    const worker = async () => {
      while (!stopped() && nextPage <= total && words <= MAX_INPUT_WORDS) {
        const pageNumber = nextPage++;
        const page = await doc.getPage(pageNumber);
        let image: string;
        try {
          image = await options.renderPage(page);
        } finally {
          page.cleanup();
        }
        if (stopped()) {
          return;
        }
        const result = await options.transcribe(image);
        if (stopped()) {
          return;
        }
        if (!result.ok) {
          fail({ ok: false, reason: "request", message: result.message });
          return;
        }
        const lines = result.unreadable ? null : transcriptionLines(result.text);
        texts[pageNumber - 1] = lines;
        words += lines ? countWords(lines.join("\n")) : 0;
        done++;
        options.onProgress?.(done, total);
      }
    };

    const workers = Array.from({ length: SCAN_CONCURRENCY }, () =>
      worker().catch((error: unknown) => {
        fail({ ok: false, reason: failureReason(error) });
      }),
    );
    await Promise.race([Promise.all(workers), failed]);
    if (failure) {
      return failure;
    }

    const pages: string[][] = [];
    const unreadablePages: number[] = [];
    texts.forEach((lines, index) => {
      if (lines === null) {
        unreadablePages.push(index + 1);
      } else if (lines !== undefined && lines.length > 0) {
        pages.push(lines);
      }
    });
    const text = toLessonText(dropRepeatedLines(pages));
    if (countWords(text) < MIN_TEXT_WORDS) {
      return { ok: false, reason: "unreadable" };
    }
    return { ok: true, ...truncateToLimit(text), pages: doc.numPages, pagesRead: done, unreadablePages };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  } finally {
    // A failed cleanup must not replace the result.
    await loadingTask?.destroy().catch(() => undefined);
  }
}
