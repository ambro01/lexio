import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it, vi } from "vitest";
import { countWords, validateInput } from "@/lib/ai/proposals";
import { MAX_PDF_BYTES, MAX_PDF_PAGES, type PdfJsModule, extractLessonText } from "./extract";
import { buildTestPdf } from "./test-pdf";

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

describe("extractLessonText", () => {
  it("extracts multi-page text in order", async () => {
    const data = buildTestPdf([
      ["First page", "has two lines"],
      ["Second (page) with a longer sentence about the weather"],
      ["Third page \\ end of the short lesson text here"],
    ]);
    const result = await extractLessonText(pdfjs, data);
    expect(result).toEqual({
      ok: true,
      text:
        "First page\nhas two lines\n\nSecond (page) with a longer sentence about the weather\n\n" +
        "Third page \\ end of the short lesson text here",
      totalWords: 23,
      truncated: false,
      pages: 3,
      pagesRead: 3,
    });
  });

  it("removes a repeated header and page numbers", async () => {
    const data = buildTestPdf([
      ["Unit 3 - page 1", "apple trees grow in the old orchard", "1"],
      ["Unit 3 - page 2", "banana boats sail across the warm sea", "2"],
      ["Unit 3 - page 3", "cherry blossoms open early this spring", "3"],
    ]);
    const result = await extractLessonText(pdfjs, data);
    expect(result.ok && result.text).toBe(
      "apple trees grow in the old orchard\n\nbanana boats sail across the warm sea\n\n" +
        "cherry blossoms open early this spring",
    );
  });

  it("returns no_text when the text layer holds fewer than 20 words", async () => {
    // Image-only exports may carry a stray label, e.g. one run-together string from a drag-and-drop exercise.
    const pages = [["intrestedtiredsatisfiedthrilledannoyedfrightening"], [], [], []];
    const result = await extractLessonText(pdfjs, buildTestPdf(pages));
    expect(result).toEqual({ ok: false, reason: "no_text" });
  });

  it("truncates a long PDF and reports the total word count", async () => {
    let next = 0;
    const line = () => Array.from({ length: 10 }, () => letters(next++)).join(" ");
    const pages = Array.from({ length: 6 }, () => Array.from({ length: 45 }, line));
    const result = await extractLessonText(pdfjs, buildTestPdf(pages));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.totalWords).toBe(2700);
      expect(result.truncated).toBe(true);
      expect(countWords(result.text)).toBe(2000);
      expect(validateInput(result.text).ok).toBe(true);
    }
  });

  it("returns no_text for a PDF without a text layer", async () => {
    const result = await extractLessonText(pdfjs, buildTestPdf([[], []]));
    expect(result).toEqual({ ok: false, reason: "no_text" });
  });

  it("returns invalid for bytes that are not a PDF", async () => {
    const data = new TextEncoder().encode("This is not a PDF file at all.");
    const result = await extractLessonText(pdfjs, data);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("returns too_large over 20 MB without parsing", async () => {
    const stub: PdfJsModule = {
      getDocument: () => {
        throw new Error("must not be called");
      },
    };
    const getDocument = vi.spyOn(stub, "getDocument");
    const result = await extractLessonText(stub, new Uint8Array(MAX_PDF_BYTES + 1));
    expect(result).toEqual({ ok: false, reason: "too_large" });
    expect(getDocument).not.toHaveBeenCalled();
  });

  it("maps a password error and anything else by error name", async () => {
    const failing = (name: string): PdfJsModule => ({
      getDocument: () => {
        const error = new Error("x");
        error.name = name;
        return { promise: Promise.reject(error), destroy: () => Promise.resolve() };
      },
    });
    expect(await extractLessonText(failing("PasswordException"), new Uint8Array(1))).toEqual({
      ok: false,
      reason: "password",
    });
    expect(await extractLessonText(failing("UnknownErrorException"), new Uint8Array(1))).toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("reads only the first 30 pages and reports progress per page", async () => {
    const pages = Array.from({ length: 32 }, (_, i) => [`text ${letters(i)}`]);
    const progress: [number, number][] = [];
    const result = await extractLessonText(pdfjs, buildTestPdf(pages), {
      onProgress: (page, total) => progress.push([page, total]),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pages).toBe(32);
      expect(result.pagesRead).toBe(MAX_PDF_PAGES);
      expect(result.text).toContain(`text ${letters(29)}`);
      expect(result.text).not.toContain(`text ${letters(30)}`);
    }
    expect(progress).toEqual(Array.from({ length: MAX_PDF_PAGES }, (_, i) => [i + 1, MAX_PDF_PAGES]));
  });
});
