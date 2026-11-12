import { describe, expect, it } from "vitest";
import { MAX_TAG_CHARS } from "@/lib/ai/limits";
import type { Flashcard } from "@/types";
import {
  MAX_PAGE_OFFSET,
  addTagRequestSchema,
  appendPage,
  editRequestSchema,
  isUuid,
  mergeTagName,
  pageQuerySchema,
  withTag,
  withoutTag,
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

function flashcard(id: string, word: string, tags: Flashcard["tags"] = []): Flashcard {
  return {
    id,
    word,
    translation: "tłumaczenie",
    additionalMeanings: [],
    exampleSentence: "",
    cefr: null,
    tags,
    createdAt: "2026-11-12T10:00:00Z",
    updatedAt: "2026-11-12T10:00:00Z",
  };
}

describe("appendPage", () => {
  it("appends the next page in order", () => {
    const loaded = [flashcard("a", "apple"), flashcard("b", "bear")];
    const next = appendPage(loaded, { cards: [flashcard("c", "cat"), flashcard("d", "dog")], hasMore: false });
    expect(next.map((card) => card.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops cards already shown and keeps the shown version", () => {
    const renamed = flashcard("b", "zebra");
    const next = appendPage([flashcard("a", "apple"), renamed], {
      cards: [flashcard("b", "bear"), flashcard("c", "cat")],
      hasMore: true,
    });
    expect(next.map((card) => card.id)).toEqual(["a", "b", "c"]);
    expect(next[1]).toBe(renamed);
  });

  it("handles an empty page", () => {
    const loaded = [flashcard("a", "apple")];
    expect(appendPage(loaded, { cards: [], hasMore: false })).toEqual(loaded);
  });
});

describe("withTag / withoutTag", () => {
  const travel = { id: "t1", name: "travel" };
  const animals = { id: "t2", name: "Animals" };
  const lesson = { id: "t3", name: "lekcja 1" };

  it("adds a tag and sorts by name", () => {
    const card = withTag(flashcard("a", "apple", [travel]), animals);
    expect(card.tags).toEqual([animals, travel]);
    expect(withTag(card, lesson).tags).toEqual([animals, lesson, travel]);
  });

  it("does not duplicate a tag the card already has", () => {
    const card = flashcard("a", "apple", [animals, travel]);
    expect(withTag(card, { ...travel }).tags).toEqual([animals, travel]);
  });

  it("removes a tag by id and leaves the original card untouched", () => {
    const card = flashcard("a", "apple", [animals, travel]);
    expect(withoutTag(card, "t2").tags).toEqual([travel]);
    expect(withoutTag(card, "missing").tags).toEqual([animals, travel]);
    expect(card.tags).toEqual([animals, travel]);
  });
});

describe("mergeTagName", () => {
  it("adds a new name and keeps the list sorted", () => {
    expect(mergeTagName(["animals", "travel"], "lekcja 1")).toEqual(["animals", "lekcja 1", "travel"]);
  });

  it("ignores a name already present in any case or spacing", () => {
    const names = ["Lekcja 1", "travel"];
    expect(mergeTagName(names, "lekcja 1")).toBe(names);
    expect(mergeTagName(names, " LEKCJA  1 ")).toBe(names);
  });

  it("ignores a blank name", () => {
    const names = ["travel"];
    expect(mergeTagName(names, "  ")).toBe(names);
  });
});
