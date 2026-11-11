import { MAX_TAG_CHARS } from "@/lib/ai/limits";
import { MAX_INPUT_CHARS, MAX_INPUT_WORDS, countWords } from "@/lib/ai/proposals";

/** A pdf.js text content item: text items have `str`, marked-content items do not. */
export interface TextContentItem {
  str?: string;
  hasEOL?: boolean;
}

/** Joins a page's text items into trimmed, non-empty lines, breaking a line after each item with `hasEOL`. */
export function pageLines(items: TextContentItem[]): string[] {
  const lines: string[] = [];
  let current = "";
  for (const item of items) {
    if (typeof item.str !== "string") {
      continue;
    }
    current += item.str;
    if (item.hasEOL) {
      lines.push(current);
      current = "";
    }
  }
  lines.push(current);
  return lines.map((line) => line.trim()).filter((line) => line !== "");
}

/** Share of pages a line must appear on to count as a repeated header or footer. */
const REPEATED_SHARE = 0.6;
const MIN_PAGES_FOR_REPEATS = 3;
const PAGE_NUMBER_LINE = /^\s*(page|strona)?\s*\d+(\s*(\/|of|z)\s*\d+)?\s*$/i;

/** Whitespace-normalised, case-insensitive, digit-stripped form, so "Unit 3 – page 4" and "Unit 3 – page 5" match. */
function repeatKey(line: string): string {
  return line.toLowerCase().replace(/\d+/g, "").replace(/\s+/g, " ").trim();
}

/** Adds to `repeated` every key that appears on at least 60% of `pages` (when there are enough pages to tell). */
function collectRepeated(pages: string[][], repeated: Set<string>): void {
  if (pages.length < MIN_PAGES_FOR_REPEATS) {
    return;
  }
  const pageCounts = new Map<string, number>();
  for (const lines of pages) {
    for (const key of new Set(lines.map(repeatKey))) {
      if (key !== "") {
        pageCounts.set(key, (pageCounts.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, count] of pageCounts) {
    if (count >= pages.length * REPEATED_SHARE) {
      repeated.add(key);
    }
  }
}

/**
 * Removes page-number-only lines and lines (compared by `repeatKey`) that appear on at least 60% of all pages, or
 * of the odd or the even pages alone (footers that alternate left/right). Each page set needs at least 3 pages.
 * A page left without lines stays as an empty page.
 */
export function dropRepeatedLines(pages: string[][]): string[][] {
  const repeated = new Set<string>();
  collectRepeated(pages, repeated);
  collectRepeated(
    pages.filter((_, index) => index % 2 === 0),
    repeated,
  );
  collectRepeated(
    pages.filter((_, index) => index % 2 === 1),
    repeated,
  );
  return pages.map((lines) => lines.filter((line) => !PAGE_NUMBER_LINE.test(line) && !repeated.has(repeatKey(line))));
}

/** Joins lines with newlines and pages with a blank line, then collapses runs of spaces/tabs and of 3+ newlines. */
export function toLessonText(pages: string[][]): string {
  return pages
    .map((lines) => lines.join("\n"))
    .join("\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface TruncatedText {
  text: string;
  /** Words in the whole text, counted with the server's `countWords` rule. */
  totalWords: number;
  truncated: boolean;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Keeps the longest prefix that ends at a whitespace boundary and has at most `maxWords` words (by `countWords`)
 * and at most `maxChars` characters, so the result passes the server's `validateInput` whenever the text has words.
 */
export function truncateToLimit(text: string, maxWords = MAX_INPUT_WORDS, maxChars = MAX_INPUT_CHARS): TruncatedText {
  const totalWords = countWords(text);
  const trimmed = text.trim();
  if (totalWords <= maxWords && trimmed.length <= maxChars) {
    return { text, totalWords, truncated: false };
  }
  let words = 0;
  let end = 0;
  for (const match of trimmed.matchAll(/\S+/g)) {
    const tokenEnd = match.index + match[0].length;
    const tokenWords = WORD_CHAR.test(match[0]) ? 1 : 0;
    if (words + tokenWords > maxWords || tokenEnd > maxChars) {
      break;
    }
    words += tokenWords;
    end = tokenEnd;
  }
  // A first token longer than maxChars has no whitespace boundary within the limit: cut it hard instead.
  const kept = end === 0 ? trimmed.slice(0, maxChars) : trimmed.slice(0, end);
  return { text: kept.trim(), totalWords, truncated: true };
}

/**
 * A lesson tag suggested from a PDF file name: drops the `.pdf` extension, turns `_` into spaces, collapses
 * whitespace and cuts the result to `maxChars`.
 */
export function tagFromFileName(fileName: string, maxChars = MAX_TAG_CHARS): string {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars)
    .trim();
}
