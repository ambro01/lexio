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
  itemProblem,
  parseDraft,
  rejectTooEasy,
  tooEasyEligibleCount,
  revertItem,
  setDecision,
  toAcceptRequest,
  tooEasyIndexes,
  undoTooEasy,
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
  null,
  [giveUp, reliable],
  new Date("2026-11-11T10:00:00Z"),
);

describe("createDraft", () => {
  it("accepts every proposal with its original content", () => {
    expect(draft).toEqual({
      version: 2,
      tagName: "Lesson 1",
      model: "anthropic/claude-haiku-5.5",
      level: null,
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
    expect(counts(draft)).toEqual({ toSave: 2, rejected: 0, tooEasyRejected: 0 });
    const next = setDecision(setDecision(draft, 0, "reject_known"), 1, "reject_wrong");
    expect(counts(next)).toEqual({ toSave: 0, rejected: 2, tooEasyRejected: 0 });
  });

  it("blocks accept while an item to save has a blank word or translation", () => {
    const blank = editItem(draft, 0, content(giveUp, { translation: "  " }));
    expect(itemProblem(itemAt(blank, 0))).toBe("Uzupełnij słowo i tłumaczenie.");
    expect(canAccept(blank)).toBe(false);
    expect(canAccept(setDecision(blank, 0, "reject_wrong"))).toBe(true);
    expect(canAccept(draft)).toBe(true);
    expect(itemProblem(itemAt(draft, 0))).toBeNull();
  });

  it("blocks accept on the meaning limits the server enforces", () => {
    const meanings = (count: number, text = "znaczenie") => Array.from({ length: count }, () => text);
    const withMeanings = (additionalMeanings: string[]) =>
      itemAt(editItem(draft, 0, content(giveUp, { additionalMeanings })), 0);

    expect(itemProblem(withMeanings([...meanings(10), "", "  "]))).toBeNull();
    expect(itemProblem(withMeanings(meanings(11)))).toMatch(/Maksymalnie 10/);
    expect(itemProblem(withMeanings(["m".repeat(501)]))).toMatch(/za długie/);
    expect(itemProblem(withMeanings(meanings(5, "m".repeat(450))))).toMatch(/za długie/);
    expect(itemProblem(withMeanings(meanings(4, "m".repeat(450))))).toBeNull();
  });

  it("matches the server: a set the UI allows is accepted by the request schema", () => {
    const next = editItem(draft, 0, content(giveUp, { additionalMeanings: Array.from({ length: 10 }, () => "x") }));
    expect(canAccept(next)).toBe(true);
    expect(acceptRequestSchema.safeParse(toAcceptRequest(next)).success).toBe(true);
    const tooMany = editItem(draft, 0, content(giveUp, { additionalMeanings: Array.from({ length: 11 }, () => "x") }));
    expect(canAccept(tooMany)).toBe(false);
    expect(acceptRequestSchema.safeParse(toAcceptRequest(tooMany)).success).toBe(false);
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

  it("round-trips a draft with a level and a too-easy rejection", () => {
    const next = rejectTooEasy(createDraft("Lesson 1", "m", "B1", [giveUp, { ...giveUp, word: "cat", cefr: "A1" }]));
    expect(next.level).toBe("B1");
    expect(parseDraft(JSON.parse(JSON.stringify(next)))).toEqual(next);
  });

  it("upgrades a version-1 draft with no level and the same items", () => {
    const { level: _level, ...rest } = setDecision(draft, 1, "reject_known");
    const v1 = JSON.parse(JSON.stringify({ ...rest, version: 1 })) as unknown;
    const parsed = parseDraft(v1);
    expect(parsed).toEqual({ ...rest, version: 2, level: null });
    expect(parsed && tooEasyIndexes(parsed)).toEqual([]);
  });

  it("rejects malformed data and another version", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("draft")).toBeNull();
    expect(parseDraft({ ...draft, version: 3 })).toBeNull();
    expect(parseDraft({ ...draft, version: 0 })).toBeNull();
    expect(parseDraft({ ...draft, level: "D1" })).toBeNull();
    expect(parseDraft({ ...draft, level: undefined })).toBeNull();
    expect(parseDraft({ ...draft, items: [] })).toBeNull();
    expect(parseDraft({ ...draft, version: 1, items: [] })).toBeNull();
    expect(parseDraft({ ...draft, tagName: "" })).toBeNull();
    expect(parseDraft({ ...draft, items: [{ ...itemAt(draft, 0), decision: "maybe" }] })).toBeNull();
    expect(parseDraft({ ...draft, items: [{ ...itemAt(draft, 0), original: { ...giveUp, cefr: "D1" } }] })).toBeNull();
  });
});

describe("too easy group", () => {
  const word = (text: string, cefr: ReviewProposal["cefr"], inCollection = false): ReviewProposal => ({
    word: text,
    translation: `${text}-pl`,
    additionalMeanings: [],
    exampleSentence: `I like ${text}.`,
    cefr,
    inCollection,
  });
  // At B1: 0, 1, 3 are too easy; 2 (B1) and 4 (A1 in the collection) are not.
  const walk = word("walk", "A2");
  const proposals = [word("cat", "A1"), walk, giveUp, word("dog", "A2"), word("home", "A1", true)];
  const leveled = createDraft("Lesson 2", "anthropic/claude-haiku-5.5", "B1", proposals);

  it("stores the level and lists the group by original index", () => {
    expect(leveled.level).toBe("B1");
    expect(tooEasyIndexes(leveled)).toEqual([0, 1, 3]);
    expect(tooEasyIndexes(createDraft("Lesson 2", "m", null, proposals))).toEqual([]);
  });

  it("bulk rejects only accepted, unedited group items", () => {
    const prepared = setDecision(editItem(leveled, 1, content(walk, { translation: "spacer" })), 3, "reject_wrong");
    // The button's count must equal what the action rejects (one shared rule).
    expect(tooEasyEligibleCount(leveled)).toBe(3);
    expect(tooEasyEligibleCount(prepared)).toBe(1);
    const next = rejectTooEasy(prepared);
    expect(tooEasyEligibleCount(next)).toBe(0);
    expect(next.items.map((item) => item.decision)).toEqual([
      "reject_too_easy",
      "accept",
      "accept",
      "reject_wrong",
      "accept",
    ]);
    expect(counts(next)).toEqual({ toSave: 3, rejected: 2, tooEasyRejected: 1 });
    expect(rejectTooEasy(next)).toBe(next);
  });

  it("undo restores only the too-easy rejections", () => {
    const rejected = setDecision(rejectTooEasy(leveled), 2, "reject_known");
    expect(counts(rejected)).toEqual({ toSave: 1, rejected: 4, tooEasyRejected: 3 });
    const undone = undoTooEasy(rejected);
    expect(undone.items.map((item) => item.decision)).toEqual(["accept", "accept", "reject_known", "accept", "accept"]);
    expect(counts(undone)).toEqual({ toSave: 4, rejected: 1, tooEasyRejected: 0 });
    expect(undoTooEasy(undone)).toBe(undone);
  });

  it("does not block accept for a too-easy rejection and round-trips through the request schema", () => {
    const next = rejectTooEasy(leveled);
    expect(itemProblem(itemAt(next, 0))).toBeNull();
    expect(canAccept(next)).toBe(true);
    const parsed = acceptRequestSchema.parse(toAcceptRequest(next));
    expect(toAcceptSetItems(parsed).map((item) => [item.word, item.outcome])).toEqual([
      ["cat", "rejected_too_easy"],
      ["walk", "rejected_too_easy"],
      ["give up", "accepted_unchanged"],
      ["dog", "rejected_too_easy"],
      ["home", "accepted_unchanged"],
    ]);
    expect(toAcceptRequest(next).items[0]).not.toHaveProperty("final");
  });
});

describe("draftStorageKey", () => {
  it("is scoped to the user", () => {
    expect(draftStorageKey("user-1")).toBe("lexio:review-draft:user-1");
    expect(draftStorageKey("user-2")).not.toBe(draftStorageKey("user-1"));
  });
});
