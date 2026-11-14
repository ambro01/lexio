import { describe, expect, it } from "vitest";
import { dropKnownWords, skippedNotice } from "./known-words";

const proposals = [{ word: "Give  Up" }, { word: "look after" }, { word: "\tRun Out\n" }, { word: "carry on" }];

describe("dropKnownWords", () => {
  it("skips case and whitespace variants of a known word", () => {
    const { kept } = dropKnownWords(proposals, new Set(["give up", "run out"]));
    expect(kept.map((proposal) => proposal.word)).toEqual(["look after", "carry on"]);
  });

  it("keeps a word that is not known", () => {
    const { kept, skipped } = dropKnownWords([{ word: "set off" }], new Set(["give up"]));
    expect(kept).toEqual([{ word: "set off" }]);
    expect(skipped).toBe(0);
  });

  it("preserves the order of the kept proposals", () => {
    const { kept } = dropKnownWords(proposals, new Set(["look after"]));
    expect(kept.map((proposal) => proposal.word)).toEqual(["Give  Up", "\tRun Out\n", "carry on"]);
  });

  it("keeps everything with an empty set", () => {
    const { kept, skipped } = dropKnownWords(proposals, new Set());
    expect(kept).toEqual(proposals);
    expect(skipped).toBe(0);
  });

  it("counts the skipped proposals", () => {
    const { skipped } = dropKnownWords(proposals, new Set(["give up", "run out", "carry on", "not proposed"]));
    expect(skipped).toBe(3);
  });
});

describe("skippedNotice", () => {
  it("returns null when nothing was skipped", () => {
    expect(skippedNotice(0, 5)).toBeNull();
    expect(skippedNotice(0, 0)).toBeNull();
  });

  it("reports the count when proposals remain", () => {
    expect(skippedNotice(3, 2)).toBe("Pominięto 3 znanych słów");
  });

  it("explains an empty result caused by skipped words", () => {
    expect(skippedNotice(4, 0)).toBe("AI nie znalazło nowych słów — pominięto 4 znanych.");
  });
});
