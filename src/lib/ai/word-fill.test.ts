import { describe, expect, it } from "vitest";
import { InvalidModelOutputError } from "./proposals";
import { parseWordFill, wordFillInputSchema, wordFillUserMessage } from "./word-fill";

const validFill = {
  word: "bank",
  translation: "brzeg",
  additionalMeanings: ["bank"],
  exampleSentence: "We had a picnic on the river bank.",
  cefr: "A2",
};

describe("parseWordFill", () => {
  it("returns a valid fill as a proposal", () => {
    expect(parseWordFill(validFill)).toEqual(validFill);
  });

  it("trims strings, drops blank meanings and upper-cases the CEFR level", () => {
    expect(
      parseWordFill({
        ...validFill,
        word: "  bank ",
        translation: " brzeg\n",
        additionalMeanings: ["  ", " bank ", ""],
        cefr: "a2",
      }),
    ).toEqual(validFill);
  });

  it("throws for a missing field", () => {
    const { translation: _translation, ...missing } = validFill;
    expect(() => parseWordFill(missing)).toThrow(InvalidModelOutputError);
  });

  it("throws for an invalid CEFR level", () => {
    expect(() => parseWordFill({ ...validFill, cefr: "D1" })).toThrow(InvalidModelOutputError);
  });

  it("throws for over-limit text", () => {
    expect(() => parseWordFill({ ...validFill, word: "a".repeat(101) })).toThrow(InvalidModelOutputError);
    expect(() => parseWordFill({ ...validFill, exampleSentence: "a".repeat(501) })).toThrow(InvalidModelOutputError);
  });

  it("throws for a non-object result", () => {
    expect(() => parseWordFill(null)).toThrow(InvalidModelOutputError);
    expect(() => parseWordFill([validFill])).toThrow(InvalidModelOutputError);
  });
});

describe("wordFillInputSchema", () => {
  it("collapses whitespace in the word", () => {
    expect(wordFillInputSchema.parse({ word: "  give \t\n up " })).toEqual({ word: "give up" });
  });

  it("rejects an empty or blank word", () => {
    expect(wordFillInputSchema.safeParse({ word: "" }).success).toBe(false);
    expect(wordFillInputSchema.safeParse({ word: "   " }).success).toBe(false);
    expect(wordFillInputSchema.safeParse({}).success).toBe(false);
  });

  it("accepts 6 words and rejects 7", () => {
    expect(wordFillInputSchema.safeParse({ word: "a b c d e f" }).success).toBe(true);
    expect(wordFillInputSchema.safeParse({ word: "a b c d e f g" }).success).toBe(false);
  });

  it("accepts 100 chars and rejects 101", () => {
    expect(wordFillInputSchema.safeParse({ word: "a".repeat(100) }).success).toBe(true);
    expect(wordFillInputSchema.safeParse({ word: "a".repeat(101) }).success).toBe(false);
  });

  it("trims the context and makes an empty one absent", () => {
    expect(wordFillInputSchema.parse({ word: "bank", context: "  I sat on the bank.  " })).toEqual({
      word: "bank",
      context: "I sat on the bank.",
    });
    expect(wordFillInputSchema.parse({ word: "bank", context: "   " }).context).toBeUndefined();
    expect(wordFillInputSchema.parse({ word: "bank", context: "" }).context).toBeUndefined();
  });

  it("rejects a context over 500 chars", () => {
    expect(wordFillInputSchema.safeParse({ word: "bank", context: "a".repeat(500) }).success).toBe(true);
    expect(wordFillInputSchema.safeParse({ word: "bank", context: "a".repeat(501) }).success).toBe(false);
  });
});

describe("wordFillUserMessage", () => {
  it("adds the context line only when given", () => {
    expect(wordFillUserMessage({ word: "bank" })).toBe("Word: bank");
    expect(wordFillUserMessage({ word: "bank", context: "I sat on the bank." })).toBe(
      "Word: bank\nContext: I sat on the bank.",
    );
  });
});
