import { describe, expect, it } from "vitest";
import { isTooEasy } from "./cefr";
import { CEFR_LEVELS, type CefrLevel } from "./proposals";

const word = (cefr: CefrLevel, inCollection = false) => ({ cefr, inCollection });

describe("isTooEasy", () => {
  it("is strict at the boundary: at B1, A2 is too easy and B1 is not", () => {
    expect(isTooEasy(word("A1"), "B1")).toBe(true);
    expect(isTooEasy(word("A2"), "B1")).toBe(true);
    expect(isTooEasy(word("B1"), "B1")).toBe(false);
    expect(isTooEasy(word("C1"), "B1")).toBe(false);
  });

  it("finds nothing too easy at the lowest level", () => {
    for (const cefr of CEFR_LEVELS) {
      expect(isTooEasy(word(cefr), "A1")).toBe(false);
    }
  });

  it("at the top of the scale, C1 is too easy and C2 is not", () => {
    expect(isTooEasy(word("C1"), "C2")).toBe(true);
    expect(isTooEasy(word("C2"), "C2")).toBe(false);
  });

  it("never marks a word already in the collection", () => {
    expect(isTooEasy(word("A1", true), "B1")).toBe(false);
    expect(isTooEasy(word("A1", true), "C2")).toBe(false);
  });

  it("marks nothing without a level", () => {
    for (const cefr of CEFR_LEVELS) {
      expect(isTooEasy(word(cefr), null)).toBe(false);
    }
  });
});
