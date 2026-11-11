import { describe, expect, it } from "vitest";
import { acceptRequestSchema, toAcceptSetItems } from "@/lib/ai/outcomes";
import { isEdited, itemProblem } from "@/lib/review-draft";
import type { ReviewProposal } from "@/types";
import { createManualItem, revertManualItem, toManualAcceptRequest, wasCorrected } from "./manual-word";

const go: ReviewProposal = {
  word: "go",
  translation: "iść",
  additionalMeanings: ["jechać"],
  exampleSentence: "We go to school every day.",
  cefr: "A1",
  inCollection: false,
};

function classify(body: ReturnType<typeof toManualAcceptRequest>) {
  const parsed = acceptRequestSchema.parse(body);
  return { parsed, items: toAcceptSetItems(parsed) };
}

describe("createManualItem", () => {
  it("starts unedited, accepted and without a problem", () => {
    const item = createManualItem(go);
    expect(item.decision).toBe("accept");
    expect(isEdited(item)).toBe(false);
    expect(itemProblem(item)).toBeNull();
  });

  it("copies the meanings, so edits never touch the AI original", () => {
    const item = createManualItem(go);
    item.final.additionalMeanings.push("chodzić");
    expect(go.additionalMeanings).toEqual(["jechać"]);
  });
});

describe("revertManualItem", () => {
  it("restores the AI content", () => {
    const item = { ...createManualItem(go), final: { ...createManualItem(go).final, translation: "jechać" } };
    expect(isEdited(item)).toBe(true);
    expect(isEdited(revertManualItem(item))).toBe(false);
  });
});

describe("wasCorrected", () => {
  it("is false for the same word, ignoring outer and repeated whitespace", () => {
    expect(wasCorrected(" give  up ", "give up")).toBe(false);
  });

  it("is true for a base form, spelling or case change", () => {
    expect(wasCorrected("went", "go")).toBe(true);
    expect(wasCorrected("Gave up", "give up")).toBe(true);
  });
});

describe("toManualAcceptRequest", () => {
  it("builds a valid manual request without a tag, recorded as accepted_unchanged", () => {
    const body = toManualAcceptRequest(createManualItem(go), "  ", "openai/gpt-4o-mini");
    expect(body).toMatchObject({ source: "manual", tagName: undefined, model: "openai/gpt-4o-mini" });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).not.toHaveProperty("original.inCollection");
    const { parsed, items } = classify(body);
    expect(parsed.tagName).toBeNull();
    expect(items).toEqual([
      {
        word: "go",
        translation: "iść",
        additionalMeanings: ["jechać"],
        exampleSentence: "We go to school every day.",
        cefr: "A1",
        outcome: "accepted_unchanged",
      },
    ]);
  });

  it("passes a trimmed tag", () => {
    const { parsed } = classify(toManualAcceptRequest(createManualItem(go), " Podróże ", "m"));
    expect(parsed.tagName).toBe("Podróże");
  });

  it("records an edited translation as accepted_corrected", () => {
    const item = createManualItem(go);
    const edited = { ...item, final: { ...item.final, translation: "pójść" } };
    const { items } = classify(toManualAcceptRequest(edited, "", "m"));
    expect(items[0]).toMatchObject({ translation: "pójść", outcome: "accepted_corrected" });
  });

  it("compares with the AI fill, not the typed word: editing 'go' back to 'went' is accepted_corrected", () => {
    const item = createManualItem(go);
    const back = { ...item, final: { ...item.final, word: "went" } };
    const { items } = classify(toManualAcceptRequest(back, "", "m"));
    expect(items[0]).toMatchObject({ word: "went", outcome: "accepted_corrected" });
  });

  it("sends inCollection false even when the fill is in the collection", () => {
    const body = toManualAcceptRequest(createManualItem({ ...go, inCollection: true }), "", "m");
    expect(body.items[0]?.inCollection).toBe(false);
  });
});
