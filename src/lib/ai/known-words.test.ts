import { describe, expect, it } from "vitest";
import { dropKnownWords } from "./known-words";

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
