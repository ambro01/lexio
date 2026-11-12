import { describe, expect, it } from "vitest";
import { MAX_TAG_CHARS } from "@/lib/ai/limits";
import {
  MAX_PAGE_OFFSET,
  addTagRequestSchema,
  editRequestSchema,
  isUuid,
  pageQuerySchema,
  type EditRequestBody,
} from "./collection";

const card: EditRequestBody = {
  word: "give up",
  translation: "poddać się",
  additionalMeanings: ["zrezygnować"],
  exampleSentence: "Don't give up now.",
  cefr: "B1",
};

describe("editRequestSchema", () => {
  it("normalises whitespace and drops blank meanings", () => {
    const parsed = editRequestSchema.parse({
      word: "  give\t up ",
      translation: " poddać  się",
      additionalMeanings: ["", "  zrezygnować ", "   "],
      exampleSentence: " Don't  give up now. ",
      cefr: "B1",
    });
    expect(parsed).toEqual(card);
  });

  it("requires a word and a translation", () => {
    expect(editRequestSchema.safeParse({ ...card, word: "   " }).success).toBe(false);
    expect(editRequestSchema.safeParse({ ...card, translation: "" }).success).toBe(false);
    const { translation: _translation, ...withoutTranslation } = card;
    expect(editRequestSchema.safeParse(withoutTranslation).success).toBe(false);
  });

  it("accepts an empty example sentence", () => {
    expect(editRequestSchema.parse({ ...card, exampleSentence: "  " }).exampleSentence).toBe("");
  });

  it("accepts a null CEFR level and rejects an unknown or missing one", () => {
    expect(editRequestSchema.parse({ ...card, cefr: null }).cefr).toBeNull();
    expect(editRequestSchema.safeParse({ ...card, cefr: "D1" }).success).toBe(false);
    const { cefr: _cefr, ...withoutCefr } = card;
    expect(editRequestSchema.safeParse(withoutCefr).success).toBe(false);
  });
});

describe("addTagRequestSchema", () => {
  it("trims and collapses whitespace", () => {
    expect(addTagRequestSchema.parse({ name: "  Lesson \t 1 " })).toEqual({ name: "Lesson 1" });
  });

  it("rejects a blank or missing name", () => {
    expect(addTagRequestSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(addTagRequestSchema.safeParse({}).success).toBe(false);
  });

  it(`accepts ${String(MAX_TAG_CHARS)} characters and rejects ${String(MAX_TAG_CHARS + 1)}`, () => {
    expect(addTagRequestSchema.safeParse({ name: "a".repeat(MAX_TAG_CHARS) }).success).toBe(true);
    expect(addTagRequestSchema.safeParse({ name: "a".repeat(MAX_TAG_CHARS + 1) }).success).toBe(false);
  });
});

describe("pageQuerySchema", () => {
  it("defaults the offset to 0", () => {
    expect(pageQuerySchema.parse({})).toEqual({ offset: 0 });
  });

  it("parses a valid offset", () => {
    expect(pageQuerySchema.parse({ offset: "50" })).toEqual({ offset: 50 });
    expect(pageQuerySchema.parse({ offset: String(MAX_PAGE_OFFSET) })).toEqual({ offset: MAX_PAGE_OFFSET });
  });

  it("rejects bad offsets", () => {
    for (const offset of ["", "-1", "1.5", "abc", "1e3", " 5", String(MAX_PAGE_OFFSET + 1), "100001"]) {
      expect(pageQuerySchema.safeParse({ offset }).success, offset).toBe(false);
    }
  });
});

describe("isUuid", () => {
  it("accepts a UUID in either case", () => {
    expect(isUuid("3f2b8c1e-9a4d-4e7b-8c6f-1a2b3c4d5e6f")).toBe(true);
    expect(isUuid("3F2B8C1E-9A4D-4E7B-8C6F-1A2B3C4D5E6F")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of [
      undefined,
      "",
      "123",
      "3f2b8c1e9a4d4e7b8c6f1a2b3c4d5e6f",
      "3f2b8c1e-9a4d-4e7b-8c6f-1a2b3c4d5e6g",
    ]) {
      expect(isUuid(value), String(value)).toBe(false);
    }
  });
});
