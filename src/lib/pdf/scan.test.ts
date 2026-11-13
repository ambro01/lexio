import { describe, expect, it } from "vitest";
import { countWords } from "@/lib/ai/proposals";
import type { PdfJsModule, PdfPage } from "./extract";
import { MAX_SCAN_PAGES, type PageTranscription, SCAN_CONCURRENCY, type ScanOptions, readScannedLesson } from "./scan";

/** Distinct letter-only words, so lines on different pages never look alike once digits are stripped. */
const letters = (i: number): string => {
  let out = "";
  let n = i;
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
};

/** `count` distinct words starting at word number `from`. */
const words = (from: number, count: number): string =>
  Array.from({ length: count }, (_, i) => letters(from + i)).join(" ");

type FakePage = PdfPage & { pageNumber: number };

/** A pdf.js stand-in with `numPages` pages; a page knows its number, so `renderPage` can return it. */
function fakePdfjs(numPages: number): PdfJsModule {
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages,
        getPage: (pageNumber: number) =>
          Promise.resolve<FakePage>({
            pageNumber,
            getTextContent: () => Promise.resolve({ items: [] }),
            getViewport: () => ({ width: 100, height: 100 }),
            render: () => ({ promise: Promise.resolve() }),
            cleanup: () => undefined,
          }),
      }),
      destroy: () => Promise.resolve(),
    }),
  };
}

const renderPage = (page: PdfPage) => Promise.resolve(`page:${String((page as FakePage).pageNumber)}`);
const pageOf = (image: string) => Number(image.slice("page:".length));

/** Waits until every pending promise callback has run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Transcribes page N as the given texts (indexed by page number - 1), recording which pages were started. */
function scripted(texts: string[]) {
  const started: number[] = [];
  const transcribe = (image: string): Promise<PageTranscription> => {
    const page = pageOf(image);
    started.push(page);
    return Promise.resolve({ ok: true, text: texts[page - 1] ?? "", unreadable: false });
  };
  return { started, transcribe };
}

function scan(numPages: number, options: Partial<ScanOptions> & Pick<ScanOptions, "transcribe">) {
  return readScannedLesson(fakePdfjs(numPages), new Uint8Array(1), { renderPage, ...options });
}

describe("readScannedLesson", () => {
  it("joins texts in page order when transcriptions finish out of order", async () => {
    const pending = new Map<number, ReturnType<typeof deferred<PageTranscription>>>();
    const transcribe = (image: string) => {
      const d = deferred<PageTranscription>();
      pending.set(pageOf(image), d);
      return d.promise;
    };
    const progress: [number, number][] = [];
    const resultPromise = scan(3, { transcribe, onProgress: (done, total) => progress.push([done, total]) });
    await settle();
    for (const page of [3, 1, 2]) {
      pending.get(page)?.resolve({ ok: true, text: words(page * 10, 8), unreadable: false });
      await settle();
    }
    const result = await resultPromise;
    expect(result).toMatchObject({ ok: true, pages: 3, pagesRead: 3, unreadablePages: [], truncated: false });
    expect(result.ok && result.text).toBe(`${words(10, 8)}\n\n${words(20, 8)}\n\n${words(30, 8)}`);
    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("skips and reports unreadable pages", async () => {
    const transcribe = (image: string): Promise<PageTranscription> => {
      const page = pageOf(image);
      const unreadable = page === 2 || page === 4;
      return Promise.resolve({ ok: true, text: unreadable ? "blurred" : words(page * 20, 12), unreadable });
    };
    const result = await scan(4, { transcribe });
    expect(result).toMatchObject({ ok: true, pages: 4, pagesRead: 4, unreadablePages: [2, 4] });
    expect(result.ok && result.text).toBe(`${words(20, 12)}\n\n${words(60, 12)}`);
  });

  it("returns unreadable when no page yields text", async () => {
    const transcribe = () => Promise.resolve<PageTranscription>({ ok: true, text: "", unreadable: true });
    expect(await scan(3, { transcribe })).toEqual({ ok: false, reason: "unreadable" });
  });

  it("returns unreadable when the joined text is under 20 words", async () => {
    const { transcribe } = scripted([words(0, 5), words(5, 5)]);
    expect(await scan(2, { transcribe })).toEqual({ ok: false, reason: "unreadable" });
  });

  it("returns the first failed request at once and starts no further pages", async () => {
    const started: number[] = [];
    const pending: ReturnType<typeof deferred<PageTranscription>>[] = [];
    const transcribe = (image: string) => {
      const page = pageOf(image);
      started.push(page);
      if (page === 2) {
        return Promise.resolve<PageTranscription>({ ok: false, message: "Usługa AI jest niedostępna." });
      }
      const d = deferred<PageTranscription>();
      pending.push(d);
      return d.promise;
    };
    const result = await scan(6, { transcribe });
    expect(result).toEqual({ ok: false, reason: "request", message: "Usługa AI jest niedostępna." });
    for (const d of pending) {
      d.resolve({ ok: true, text: words(0, 30), unreadable: false });
    }
    await settle();
    expect(started.sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("starts no new page after the text exceeds the word limit", async () => {
    const started: number[] = [];
    const pending = new Map<number, ReturnType<typeof deferred<PageTranscription>>>();
    const transcribe = (image: string) => {
      const d = deferred<PageTranscription>();
      started.push(pageOf(image));
      pending.set(pageOf(image), d);
      return d.promise;
    };
    const resultPromise = scan(8, { transcribe });
    await settle();
    expect(started).toEqual([1, 2, 3]);
    // 1,100 words a page: after page 1 the next page starts, after page 2 (2,200 words) none does.
    for (const page of [1, 2, 3, 4]) {
      pending.get(page)?.resolve({ ok: true, text: words(page * 1100, 1100), unreadable: false });
      await settle();
    }
    const result = await resultPromise;
    expect(started).toEqual([1, 2, 3, 4]);
    expect(result).toMatchObject({ ok: true, pages: 8, pagesRead: 4, totalWords: 4400, truncated: true });
    expect(result.ok && countWords(result.text)).toBe(2000);
  });

  it("reads at most 15 pages", async () => {
    const texts = Array.from({ length: 20 }, (_, i) => words(i * 10, 10));
    const { started, transcribe } = scripted(texts);
    const progress: number[] = [];
    const result = await scan(20, { transcribe, onProgress: (_, total) => progress.push(total) });
    expect(started.sort((a, b) => a - b)).toEqual(Array.from({ length: MAX_SCAN_PAGES }, (_, i) => i + 1));
    expect(result).toMatchObject({ ok: true, pages: 20, pagesRead: MAX_SCAN_PAGES });
    expect(new Set(progress)).toEqual(new Set([MAX_SCAN_PAGES]));
  });

  it("never runs more than 3 transcriptions at once", async () => {
    let active = 0;
    let maxActive = 0;
    const transcribe = async (image: string): Promise<PageTranscription> => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, pageOf(image) % 3));
      active--;
      return { ok: true, text: words(pageOf(image) * 10, 10), unreadable: false };
    };
    const result = await scan(10, { transcribe });
    expect(result).toMatchObject({ ok: true, pagesRead: 10 });
    expect(maxActive).toBe(SCAN_CONCURRENCY);
  });

  it("drops a repeated header", async () => {
    const texts = Array.from({ length: 3 }, (_, i) => `linguahouse.com\n${words(i * 10, 10)}`);
    const { transcribe } = scripted(texts);
    const result = await scan(3, { transcribe });
    expect(result.ok && result.text).toBe(`${words(0, 10)}\n\n${words(10, 10)}\n\n${words(20, 10)}`);
  });

  it("truncates the result to 2,000 words", async () => {
    const texts = Array.from({ length: 2 }, (_, i) => words(i * 1200, 1200));
    const { transcribe } = scripted(texts);
    const result = await scan(2, { transcribe });
    expect(result).toMatchObject({ ok: true, totalWords: 2400, truncated: true });
    expect(result.ok && countWords(result.text)).toBe(2000);
  });

  it("maps a password error by name", async () => {
    const pdfjs: PdfJsModule = {
      getDocument: () => {
        const error = new Error("x");
        error.name = "PasswordException";
        return { promise: Promise.reject(error), destroy: () => Promise.resolve() };
      },
    };
    const result = await readScannedLesson(pdfjs, new Uint8Array(1), {
      renderPage,
      transcribe: scripted([]).transcribe,
    });
    expect(result).toEqual({ ok: false, reason: "password" });
  });
});
