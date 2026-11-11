import { describe, expect, it } from "vitest";
import { countWords, validateInput } from "@/lib/ai/proposals";
import { dropRepeatedLines, pageLines, tagFromFileName, toLessonText, truncateToLimit } from "./lesson-text";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("pageLines", () => {
  it("joins items into lines broken on hasEOL", () => {
    const items = [{ str: "Hello" }, { str: " world", hasEOL: true }, { str: "Second" }, { str: " line" }];
    expect(pageLines(items)).toEqual(["Hello world", "Second line"]);
  });

  it("skips items without str and drops empty lines", () => {
    const items = [{}, { str: "  A  ", hasEOL: true }, { str: "", hasEOL: true }, { hasEOL: true }, { str: " B" }];
    expect(pageLines(items)).toEqual(["A", "B"]);
  });
});

describe("dropRepeatedLines", () => {
  it("removes footers that alternate between odd and even pages", () => {
    // Real worksheet: "FOOTERRIGHT 1/8 Learn" on odd pages, "FOOTERLEFT 2/8 Learn" on even pages (50% each).
    const pages = Array.from({ length: 8 }, (_, i) => [
      `content ${"abcdefgh"[i] ?? ""}`,
      i % 2 === 0 ? `FOOTERRIGHT ${String(i + 1)}/8 Learn` : `FOOTERLEFT ${String(i + 1)}/8 Learn`,
    ]);
    expect(dropRepeatedLines(pages)).toEqual(Array.from("abcdefgh", (letter) => [`content ${letter}`]));
  });

  it("keeps a line on both odd pages of a short PDF (each page set needs 4 pages)", () => {
    const pages = [["Exercise", "one"], ["two"], ["Exercise", "three"], ["four"]];
    expect(dropRepeatedLines(pages)).toEqual(pages);
  });

  it("keeps lines that repeat on two same-parity pages of a 5-page PDF", () => {
    const pages = [["Exercise 1", "Read the dialogue."], ["b"], ["Exercise 2", "Read the dialogue."], ["d"], ["e"]];
    expect(dropRepeatedLines(pages)).toEqual(pages);
  });

  it("keeps a line on only half of the odd pages of a longer PDF", () => {
    // Filler words are distinct letters: digits are stripped when comparing lines.
    const pages = Array.from("abcdefgh", (letter, i) =>
      i === 0 || i === 2 ? ["Warm up", `page ${letter}`] : [`page ${letter}`],
    );
    expect(dropRepeatedLines(pages)).toEqual(pages);
  });

  it("removes a header that is on every page", () => {
    const pages = [
      ["English Lesson", "one"],
      ["English Lesson", "two"],
      ["English  lesson", "three"],
    ];
    expect(dropRepeatedLines(pages)).toEqual([["one"], ["two"], ["three"]]);
  });

  it("removes headers that differ only by page number", () => {
    const pages = [
      ["Unit 3 – page 4", "one"],
      ["Unit 3 – page 5", "two"],
      ["Unit 3 – page 6", "three"],
    ];
    expect(dropRepeatedLines(pages)).toEqual([["one"], ["two"], ["three"]]);
  });

  it("removes page-number-only lines", () => {
    const pages = [
      ["one", "Page 3 of 10"],
      ["two", "Strona 3"],
      ["three", "3"],
      ["four", "4 / 10"],
      ["five", "5 z 10"],
    ];
    expect(dropRepeatedLines(pages)).toEqual([["one"], ["two"], ["three"], ["four"], ["five"]]);
  });

  it("keeps a line repeated on 2 of 5 pages", () => {
    const pages = [["Vocabulary", "a"], ["Vocabulary", "b"], ["c"], ["d"], ["e"]];
    expect(dropRepeatedLines(pages)).toEqual(pages);
  });

  it("with fewer than 3 pages removes only page-number lines", () => {
    const pages = [
      ["Header", "one", "1"],
      ["Header", "two", "Page 2"],
    ];
    expect(dropRepeatedLines(pages)).toEqual([
      ["Header", "one"],
      ["Header", "two"],
    ]);
  });

  it("keeps a page that ends up empty", () => {
    const pages = [["Header", "one"], ["Header"], ["Header", "three"]];
    expect(dropRepeatedLines(pages)).toEqual([["one"], [], ["three"]]);
  });
});

describe("toLessonText", () => {
  it("joins lines and pages and collapses whitespace", () => {
    expect(toLessonText([["a  b", "c\t\td"], [], ["e"]])).toBe("a b\nc d\n\ne");
  });
});

describe("truncateToLimit", () => {
  it("returns text under the limit unchanged", () => {
    expect(truncateToLimit("Hello world")).toEqual({ text: "Hello world", totalWords: 2, truncated: false });
  });

  it("cuts 2500 words to exactly 2000", () => {
    const result = truncateToLimit(words(2500));
    expect(result.totalWords).toBe(2500);
    expect(result.truncated).toBe(true);
    expect(countWords(result.text)).toBe(2000);
    expect(result.text).toBe(words(2000));
    expect(validateInput(result.text).ok).toBe(true);
  });

  it("does not count punctuation-only tokens as words", () => {
    const text = `${words(2000)} — ... ${words(10)}`;
    const result = truncateToLimit(text);
    expect(result.totalWords).toBe(2010);
    expect(countWords(result.text)).toBe(2000);
    expect(result.text.startsWith(words(2000))).toBe(true);
  });

  it("respects the character cap for long words", () => {
    const long = Array.from({ length: 400 }, () => "a".repeat(99)).join(" ");
    const result = truncateToLimit(long);
    expect(result.totalWords).toBe(400);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(30000);
    expect(result.text.length).toBe(300 * 100 - 1);
    expect(validateInput(result.text).ok).toBe(true);
  });

  it("cuts a single token longer than the character cap", () => {
    const result = truncateToLimit("a".repeat(30001));
    expect(result.text.length).toBe(30000);
    expect(validateInput(result.text).ok).toBe(true);
  });

  it("always produces text that passes validateInput", () => {
    const samples = [
      words(2001),
      `\n  ${words(3000)}\n\n`,
      Array.from({ length: 2100 }, (_, i) => `x${i}${".".repeat(i % 20)} –`).join("\n"),
      Array.from({ length: 1500 }, () => "abcdefghijklmnopqrstu").join("  "),
    ];
    for (const sample of samples) {
      expect(validateInput(truncateToLimit(sample).text).ok).toBe(true);
    }
  });
});

describe("tagFromFileName", () => {
  it("never splits an emoji at the length limit and stays within the UTF-16 limit", () => {
    const name = `${"a".repeat(49)}😀 more.pdf`;
    const tag = tagFromFileName(name);
    expect(tag).toBe("a".repeat(49));
    expect(tag.length).toBeLessThanOrEqual(50);
    expect(tagFromFileName(`${"a".repeat(48)}😀.pdf`)).toBe(`${"a".repeat(48)}😀`);
  });

  it("drops the .pdf extension, turns underscores into spaces and collapses whitespace", () => {
    expect(tagFromFileName("Unit_12__travel  plans.PDF")).toBe("Unit 12 travel plans");
  });

  it("keeps names without a .pdf extension", () => {
    expect(tagFromFileName("lesson.pdf.txt")).toBe("lesson.pdf.txt");
  });

  it("cuts the tag to the maximum length without a trailing space", () => {
    expect(tagFromFileName(`${"a".repeat(49)}_b_c.pdf`)).toBe("a".repeat(49));
    expect(tagFromFileName(`${"a".repeat(60)}.pdf`)).toHaveLength(50);
  });
});
