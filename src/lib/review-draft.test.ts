import { describe, expect, it } from "vitest";
import { acceptRequestSchema, toAcceptSetItems } from "@/lib/ai/outcomes";
import type { ProposalContent, ReviewProposal } from "@/types";
import {
  canAccept,
  counts,
  createDraft,
  draftStorageKey,
  editItem,
  isEdited,
  isIncomplete,
  parseDraft,
  revertItem,
  setDecision,
  toAcceptRequest,
  type DraftItem,
  type ReviewDraft,
} from "./review-draft";

const giveUp: ReviewProposal = {
  word: "give up",
  translation: "poddać się",
  additionalMeanings: ["zrezygnować"],
  exampleSentence: "Don't give up now.",
  cefr: "B1",
  inCollection: false,
};

const reliable: ReviewProposal = {
  word: "reliable",
  translation: "niezawodny",
  additionalMeanings: [],
  exampleSentence: "She is a reliable friend.",
  cefr: "B2",
  inCollection: true,
};

/** The editable content of a proposal, optionally changed. */
function content(proposal: ReviewProposal, changes: Partial<ProposalContent> = {}): ProposalContent {
  return {
    word: proposal.word,
    translation: proposal.translation,
    additionalMeanings: proposal.additionalMeanings,
    exampleSentence: proposal.exampleSentence,
    ...changes,
  };
}

function itemAt(d: ReviewDraft, index: number): DraftItem {
  const found = d.items.at(index);
  if (!found) {
    throw new Error(`no item ${String(index)}`);
  }
  return found;
}

const draft = createDraft(
  "Lesson 1",
  "anthropic/claude-haiku-5.5",
  [giveUp, reliable],
  new Date("2026-11-11T10:00:00Z"),
);

describe("createDraft", () => {
  it("accepts every proposal with its original content", () => {
    expect(draft).toEqual({
      version: 1,
      tagName: "Lesson 1",
      model: "anthropic/claude-haiku-5.5",
      createdAt: "2026-11-11T10:00:00.000Z",
      items: [
        { original: giveUp, final: content(giveUp), decision: "accept" },
        { original: reliable, final: content(reliable), decision: "accept" },
      ],
    });
  });

  it("does not share the meanings array with the original", () => {
    expect(itemAt(draft, 0).final.additionalMeanings).not.toBe(giveUp.additionalMeanings);
  });
});

describe("transitions", () => {
  const edited = content(giveUp, { translation: "zrezygnować", additionalMeanings: ["poddać się"] });

  it("edits an item without touching the others", () => {
    const next = editItem(draft, 0, edited);
    expect(itemAt(next, 0).final).toEqual(edited);
    expect(itemAt(next, 1)).toBe(itemAt(draft, 1));
    expect(itemAt(draft, 0).final.translation).toBe("poddać się");
    expect(isEdited(itemAt(next, 0))).toBe(true);
  });

  it("ignores edits of a word already in the collection", () => {
    expect(editItem(draft, 1, content(reliable, { translation: "pewny" }))).toBe(draft);
  });

  it("ignores an index out of range", () => {
    expect(editItem(draft, 5, edited)).toBe(draft);
    expect(setDecision(draft, -1, "reject_known")).toBe(draft);
  });

  it("rejects and undoes a rejection, keeping the edit", () => {
    const rejected = setDecision(editItem(draft, 0, edited), 0, "reject_wrong");
    expect(itemAt(rejected, 0).decision).toBe("reject_wrong");
    const undone = setDecision(rejected, 0, "accept");
    expect(itemAt(undone, 0).decision).toBe("accept");
    expect(itemAt(undone, 0).final).toEqual(edited);
  });

  it("reverts an edit to the AI original", () => {
    const reverted = revertItem(editItem(draft, 0, edited), 0);
    expect(itemAt(reverted, 0).final).toEqual(content(giveUp));
    expect(isEdited(itemAt(reverted, 0))).toBe(false);
  });

  it("treats a whitespace-only edit as unchanged", () => {
    const next = editItem(draft, 0, content(giveUp, { word: " give  up ", additionalMeanings: ["zrezygnować", ""] }));
    expect(isEdited(itemAt(next, 0))).toBe(false);
  });
});

describe("counts and accept guard", () => {
  it("counts items to save and rejected items", () => {
    expect(counts(draft)).toEqual({ toSave: 2, rejected: 0 });
    const next = setDecision(setDecision(draft, 0, "reject_known"), 1, "reject_wrong");
    expect(counts(next)).toEqual({ toSave: 0, rejected: 2 });
  });

  it("blocks accept while an item to save has a blank word or translation", () => {
    const blank = editItem(draft, 0, content(giveUp, { translation: "  " }));
    expect(isIncomplete(itemAt(blank, 0))).toBe(true);
    expect(canAccept(blank)).toBe(false);
    expect(canAccept(setDecision(blank, 0, "reject_wrong"))).toBe(true);
    expect(canAccept(draft)).toBe(true);
  });
});

describe("toAcceptRequest", () => {
  const giveUpOriginal = {
    word: "give up",
    translation: "poddać się",
    additionalMeanings: ["zrezygnować"],
    exampleSentence: "Don't give up now.",
    cefr: "B1",
  };

  it("sends no final content for a rejected item", () => {
    const rejected = setDecision(editItem(draft, 0, content(giveUp, { translation: "rzucić" })), 0, "reject_known");
    expect(toAcceptRequest(rejected).items[0]).toEqual({
      decision: "reject_known",
      original: giveUpOriginal,
      inCollection: false,
    });
  });

  it("sends the edited content for an accepted item and the original for a word in the collection", () => {
    const next = editItem(draft, 0, content(giveUp, { translation: "rzucić" }));
    const request = toAcceptRequest(next);
    expect(request.items[0]).toEqual({
      decision: "accept",
      original: giveUpOriginal,
      inCollection: false,
      final: content(giveUp, { translation: "rzucić" }),
    });
    expect(request.items[1]).toEqual({
      decision: "accept",
      original: { ...content(reliable), cefr: "B2" },
      inCollection: true,
      final: content(reliable),
    });
  });

  it("produces a body the server accepts and classifies as expected", () => {
    const next = setDecision(editItem(draft, 0, content(giveUp, { translation: "rzucić" })), 1, "reject_wrong");
    const parsed = acceptRequestSchema.parse(toAcceptRequest(next));
    expect(parsed.tagName).toBe("Lesson 1");
    expect(toAcceptSetItems(parsed).map((item) => [item.word, item.outcome])).toEqual([
      ["give up", "accepted_corrected"],
      ["reliable", "rejected_wrong"],
    ]);
  });
});

describe("parseDraft", () => {
  it("round-trips a draft through JSON", () => {
    const next = setDecision(editItem(draft, 0, content(giveUp, { word: "give in" })), 1, "reject_known");
    expect(parseDraft(JSON.parse(JSON.stringify(next)))).toEqual(next);
  });

  it("rejects malformed data and another version", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("draft")).toBeNull();
    expect(parseDraft({ ...draft, version: 2 })).toBeNull();
    expect(parseDraft({ ...draft, items: [] })).toBeNull();
    expect(parseDraft({ ...draft, tagName: "" })).toBeNull();
    expect(parseDraft({ ...draft, items: [{ ...itemAt(draft, 0), decision: "maybe" }] })).toBeNull();
    expect(parseDraft({ ...draft, items: [{ ...itemAt(draft, 0), original: { ...giveUp, cefr: "D1" } }] })).toBeNull();
  });
});

describe("draftStorageKey", () => {
  it("is scoped to the user", () => {
    expect(draftStorageKey("user-1")).toBe("lexio:review-draft:user-1");
    expect(draftStorageKey("user-2")).not.toBe(draftStorageKey("user-1"));
  });
});
