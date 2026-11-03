import { describe, expect, it } from "vitest";
import { InvalidModelOutputError, countWords, parseProposals, validateInput } from "./proposals";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

const validItem = {
  word: "give up",
  translation: "poddać się",
  additionalMeanings: ["rzucić (nałóg)"],
  exampleSentence: "Don't give up now.",
  cefr: "B1",
};

describe("countWords", () => {
  it("counts whitespace-separated tokens with a letter or digit", () => {
    expect(countWords("Hello,  world!\n\t42 — ...")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("validateInput", () => {
  it("rejects empty and whitespace-only input", () => {
    expect(validateInput("")).toEqual({ ok: false, code: "empty", words: 0 });
    expect(validateInput("   \n\t ")).toEqual({ ok: false, code: "empty", words: 0 });
    expect(validateInput(undefined)).toEqual({ ok: false, code: "empty", words: 0 });
  });

  it("accepts exactly 2000 words and trims the text", () => {
    const text = words(2000);
    expect(validateInput(`  ${text}\n`)).toEqual({ ok: true, text, words: 2000 });
  });

  it("rejects 2001 words", () => {
    expect(validateInput(words(2001))).toEqual({ ok: false, code: "too_long", words: 2001 });
  });

  it("rejects 30001 characters without spaces", () => {
    expect(validateInput("a".repeat(30001))).toEqual({ ok: false, code: "too_long", words: 1 });
  });
});

describe("parseProposals", () => {
  it("returns valid items with trimmed strings", () => {
    const result = parseProposals({
      proposals: [{ ...validItem, word: "  give up ", additionalMeanings: [" rzucić ", ""] }],
    });
    expect(result).toEqual({
      proposals: [{ ...validItem, additionalMeanings: ["rzucić"] }],
      dropped: 0,
    });
  });

  it("drops items with a missing or empty required field", () => {
    const { translation: _translation, ...missingTranslation } = validItem;
    const result = parseProposals({
      proposals: [validItem, missingTranslation, { ...validItem, word: "run", exampleSentence: "  " }],
    });
    expect(result.proposals.map((p) => p.word)).toEqual(["give up"]);
    expect(result.dropped).toBe(2);
  });

  it("drops items with an invalid CEFR level", () => {
    const result = parseProposals({ proposals: [validItem, { ...validItem, word: "run", cefr: "D1" }] });
    expect(result.proposals).toHaveLength(1);
    expect(result.dropped).toBe(1);
  });

  it("drops repeated words case-insensitively and keeps the first", () => {
    const result = parseProposals({
      proposals: [validItem, { ...validItem, word: "Give Up", translation: "zrezygnować" }],
    });
    expect(result.proposals).toEqual([validItem]);
    expect(result.dropped).toBe(1);
  });

  it("throws when the root is not an object with a proposals array", () => {
    expect(() => parseProposals(null)).toThrow(InvalidModelOutputError);
    expect(() => parseProposals([validItem])).toThrow(InvalidModelOutputError);
    expect(() => parseProposals({ proposals: "none" })).toThrow(InvalidModelOutputError);
  });
});
