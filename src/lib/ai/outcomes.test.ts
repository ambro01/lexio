import { describe, expect, it } from "vitest";
import type { ProposalContent } from "@/types";
import {
  MAX_SET_ITEMS,
  acceptRequestSchema,
  classifyOutcome,
  normaliseContent,
  toAcceptSetItems,
  type AcceptRequestBody,
} from "./outcomes";

const original: ProposalContent = {
  word: "give up",
  translation: "poddać się",
  additionalMeanings: ["zrezygnować", "rzucić (nałóg)"],
  exampleSentence: "Don't give up now.",
};

const proposal = { ...original, cefr: "B1" as const };

function body(items: AcceptRequestBody["items"], tagName = "Lesson 1"): AcceptRequestBody {
  return { tagName, model: "anthropic/claude-haiku-5.5", items };
}

describe("normaliseContent", () => {
  it("collapses whitespace, trims and drops blank meanings", () => {
    expect(
      normaliseContent({
        word: "  give\t up ",
        translation: "poddać\n się",
        additionalMeanings: [" zrezygnować ", "  ", ""],
        exampleSentence: " Don't  give up. ",
      }),
    ).toEqual({
      word: "give up",
      translation: "poddać się",
      additionalMeanings: ["zrezygnować"],
      exampleSentence: "Don't give up.",
    });
  });
});

describe("classifyOutcome", () => {
  it("unchanged content is accepted_unchanged", () => {
    expect(classifyOutcome("accept", original, { ...original })).toBe("accepted_unchanged");
  });

  it("a whitespace-only change is still unchanged", () => {
    const final = { ...original, word: " give  up", exampleSentence: "Don't give up now.\n" };
    expect(classifyOutcome("accept", original, final)).toBe("accepted_unchanged");
  });

  it("a case change in the translation is a correction", () => {
    expect(classifyOutcome("accept", original, { ...original, translation: "Poddać się" })).toBe("accepted_corrected");
  });

  it("an edit reverted to the original is unchanged", () => {
    const edited = { ...original, word: "give in" };
    const reverted = { ...edited, word: original.word };
    expect(classifyOutcome("accept", original, reverted)).toBe("accepted_unchanged");
  });

  it("adding, removing or reordering a meaning is a correction", () => {
    const [first, second] = original.additionalMeanings;
    for (const additionalMeanings of [[first, second, "odpuścić"], [first], [second, first]]) {
      expect(classifyOutcome("accept", original, { ...original, additionalMeanings })).toBe("accepted_corrected");
    }
  });

  it("adding a blank meaning is unchanged", () => {
    const final = { ...original, additionalMeanings: [...original.additionalMeanings, "  "] };
    expect(classifyOutcome("accept", original, final)).toBe("accepted_unchanged");
  });

  it("rejections map to their outcome regardless of the final content", () => {
    const changed = { ...original, word: "something else" };
    expect(classifyOutcome("reject_known", original, changed)).toBe("rejected_known");
    expect(classifyOutcome("reject_wrong", original, original)).toBe("rejected_wrong");
    expect(classifyOutcome("reject_too_easy", original, changed)).toBe("rejected_too_easy");
  });
});

describe("acceptRequestSchema", () => {
  it("accepts a valid request and normalises its strings", () => {
    const parsed = acceptRequestSchema.parse(
      body([{ decision: "accept", original: proposal, inCollection: false, final: original }], "  Lesson   1 "),
    );
    expect(parsed.tagName).toBe("Lesson 1");
  });

  it("requires final for an accepted proposal", () => {
    const result = acceptRequestSchema.safeParse(
      body([{ decision: "accept", original: proposal, inCollection: false }]),
    );
    expect(result.success).toBe(false);
  });

  it("does not require final for a rejected proposal", () => {
    const result = acceptRequestSchema.safeParse(
      body([{ decision: "reject_known", original: proposal, inCollection: false }]),
    );
    expect(result.success).toBe(true);
  });

  it("does not require final for a proposal rejected as too easy", () => {
    const result = acceptRequestSchema.safeParse(
      body([{ decision: "reject_too_easy", original: proposal, inCollection: false }]),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an unknown decision", () => {
    const result = acceptRequestSchema.safeParse(
      body([{ decision: "reject_maybe" as "reject_known", original: proposal, inCollection: false }]),
    );
    expect(result.success).toBe(false);
  });

  it("rejects more than the item limit and an empty set", () => {
    const item = { decision: "reject_wrong" as const, original: proposal, inCollection: false };
    expect(acceptRequestSchema.safeParse(body(Array.from({ length: MAX_SET_ITEMS + 1 }, () => item))).success).toBe(
      false,
    );
    expect(acceptRequestSchema.safeParse(body(Array.from({ length: MAX_SET_ITEMS }, () => item))).success).toBe(true);
    expect(acceptRequestSchema.safeParse(body([])).success).toBe(false);
  });

  it("rejects a blank tag name", () => {
    const item = { decision: "reject_wrong" as const, original: proposal, inCollection: false };
    expect(acceptRequestSchema.safeParse(body([item], "   ")).success).toBe(false);
  });

  it("rejects a blank final word and translation, and an over-long word", () => {
    for (const final of [
      { ...original, word: "  " },
      { ...original, translation: "" },
      { ...original, word: "x".repeat(101) },
    ]) {
      const result = acceptRequestSchema.safeParse(
        body([{ decision: "accept", original: proposal, inCollection: false, final }]),
      );
      expect(result.success).toBe(false);
    }
  });

  it("rejects more than 10 meanings, but not blank lines beyond them", () => {
    const tooMany = { ...original, additionalMeanings: Array.from({ length: 11 }, (_, i) => `m${String(i)}`) };
    const withBlanks = { ...original, additionalMeanings: [...Array.from({ length: 10 }, () => "m"), "", " "] };
    const parse = (final: ProposalContent) =>
      acceptRequestSchema.safeParse(body([{ decision: "accept", original: proposal, inCollection: false, final }]));
    expect(parse(tooMany).success).toBe(false);
    expect(parse(withBlanks).success).toBe(true);
  });
});

describe("toAcceptSetItems", () => {
  const items = (requestItems: AcceptRequestBody["items"]) =>
    toAcceptSetItems(acceptRequestSchema.parse(body(requestItems)));

  it("classifies an edited proposal as corrected and stores the final content", () => {
    const final = { ...original, translation: "Poddać się" };
    expect(items([{ decision: "accept", original: proposal, inCollection: false, final }])).toEqual([
      { ...final, cefr: "B1", outcome: "accepted_corrected" },
    ]);
  });

  it("ignores the client final for an inCollection proposal", () => {
    const final = { ...original, word: "give in", translation: "ustąpić" };
    expect(items([{ decision: "accept", original: proposal, inCollection: true, final }])).toEqual([
      { ...original, cefr: "B1", outcome: "accepted_unchanged" },
    ]);
  });

  it("records the AI original word for a rejected proposal", () => {
    const final = { ...original, word: "give in" };
    const [item] = items([{ decision: "reject_wrong", original: proposal, inCollection: false, final }]);
    expect(item.word).toBe("give up");
    expect(item.outcome).toBe("rejected_wrong");
  });

  it("records the AI original word for a proposal rejected as too easy", () => {
    const final = { ...original, word: "give in" };
    expect(items([{ decision: "reject_too_easy", original: proposal, inCollection: false, final }])).toEqual([
      { ...original, cefr: "B1", outcome: "rejected_too_easy" },
    ]);
  });
});
