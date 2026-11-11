// The review of one generated proposal set: every state transition is a pure function over a serialisable
// draft, so the UI can persist it to localStorage and the tests can run without React.
import { z } from "zod";
import { MAX_MEANINGS, MAX_MEANINGS_CHARS, MAX_TEXT_CHARS } from "@/lib/ai/limits";
import { isTooEasy } from "@/lib/ai/cefr";
import { CEFR_LEVELS } from "@/lib/ai/proposals";
import { PROPOSAL_DECISIONS, classifyOutcome, normaliseContent, type AcceptRequestBody } from "@/lib/ai/outcomes";
import type { CefrLevel, ProposalContent, ProposalDecision, ReviewProposal } from "@/types";

/** Version 2 added `level`; a stored version-1 draft is upgraded on read (see `parseDraft`). */
export const DRAFT_VERSION = 2;

export interface DraftItem {
  original: ReviewProposal;
  final: ProposalContent;
  decision: ProposalDecision;
}

export interface ReviewDraft {
  version: typeof DRAFT_VERSION;
  tagName: string;
  model: string;
  /** The profile level when the draft was created; a later profile change does not regroup it. */
  level: CefrLevel | null;
  createdAt: string;
  items: DraftItem[];
}

function contentOf(proposal: ReviewProposal): ProposalContent {
  return {
    word: proposal.word,
    translation: proposal.translation,
    additionalMeanings: [...proposal.additionalMeanings],
    exampleSentence: proposal.exampleSentence,
  };
}

export function createDraft(
  tagName: string,
  model: string,
  level: CefrLevel | null,
  proposals: ReviewProposal[],
  now: Date = new Date(),
): ReviewDraft {
  return {
    version: DRAFT_VERSION,
    tagName,
    model,
    level,
    createdAt: now.toISOString(),
    items: proposals.map((proposal) => ({ original: proposal, final: contentOf(proposal), decision: "accept" })),
  };
}

function updateItem(draft: ReviewDraft, index: number, update: (item: DraftItem) => DraftItem): ReviewDraft {
  const item = draft.items.at(index);
  if (index < 0 || !item) {
    return draft;
  }
  const next = update(item);
  return next === item ? draft : { ...draft, items: draft.items.map((current, i) => (i === index ? next : current)) };
}

/** Replaces an item's editable content. Words already in the collection cannot be edited. */
export function editItem(draft: ReviewDraft, index: number, final: ProposalContent): ReviewDraft {
  return updateItem(draft, index, (item) => (item.original.inCollection ? item : { ...item, final }));
}

export function setDecision(draft: ReviewDraft, index: number, decision: ProposalDecision): ReviewDraft {
  return updateItem(draft, index, (item) => (item.decision === decision ? item : { ...item, decision }));
}

/** Restores the AI original content of an item. */
export function revertItem(draft: ReviewDraft, index: number): ReviewDraft {
  return updateItem(draft, index, (item) => ({ ...item, final: contentOf(item.original) }));
}

/** True when the item's content differs from the AI original by the same rule the server records. */
export function isEdited(item: DraftItem): boolean {
  return classifyOutcome("accept", item.original, item.final) === "accepted_corrected";
}

/** Indexes (in `draft.items`) of the items in the "too easy" group, by the level stored in the draft. */
export function tooEasyIndexes(draft: ReviewDraft): number[] {
  return draft.items.flatMap((item, index) => (isTooEasy(item.original, draft.level) ? [index] : []));
}

/** The one rule for which group items the bulk reject applies to: still accepted and unedited. */
function tooEasyEligible(draft: ReviewDraft): (item: DraftItem, index: number) => boolean {
  const group = new Set(tooEasyIndexes(draft));
  return (item, index) => group.has(index) && item.decision === "accept" && !isEdited(item);
}

/** How many group items "Odrzuć wszystkie jako Za łatwe" would reject now. */
export function tooEasyEligibleCount(draft: ReviewDraft): number {
  return draft.items.filter(tooEasyEligible(draft)).length;
}

/** Rejects as "too easy" every group item that is still accepted and unedited; other items are unchanged. */
export function rejectTooEasy(draft: ReviewDraft): ReviewDraft {
  const eligible = tooEasyEligible(draft);
  if (!draft.items.some(eligible)) {
    return draft;
  }
  return {
    ...draft,
    items: draft.items.map((item, index) =>
      eligible(item, index) ? { ...item, decision: "reject_too_easy" as const } : item,
    ),
  };
}

/** Undoes the bulk reject: every item rejected as "too easy" goes back to accept (only the bulk action sets it). */
export function undoTooEasy(draft: ReviewDraft): ReviewDraft {
  if (!draft.items.some((item) => item.decision === "reject_too_easy")) {
    return draft;
  }
  return {
    ...draft,
    items: draft.items.map((item) =>
      item.decision === "reject_too_easy" ? { ...item, decision: "accept" as const } : item,
    ),
  };
}

/** `rejected` counts every rejection, including the "too easy" ones counted again in `tooEasyRejected`. */
export function counts(draft: ReviewDraft): { toSave: number; rejected: number; tooEasyRejected: number } {
  const toSave = draft.items.filter((item) => item.decision === "accept").length;
  const tooEasyRejected = draft.items.filter((item) => item.decision === "reject_too_easy").length;
  return { toSave, rejected: draft.items.length - toSave, tooEasyRejected };
}

/**
 * Why an item that would be saved is refused by the accept request, or null when it is fine. Word, translation
 * and example lengths are capped by the inputs; the meanings are checked here like the server does.
 */
export function itemProblem(item: DraftItem): string | null {
  if (item.decision !== "accept") {
    return null;
  }
  const { word, translation, additionalMeanings } = item.final;
  if (word.trim() === "" || translation.trim() === "") {
    return "Uzupełnij słowo i tłumaczenie.";
  }
  const meanings = normaliseContent(item.final).additionalMeanings;
  if (meanings.length > MAX_MEANINGS) {
    return `Maksymalnie ${String(MAX_MEANINGS)} innych znaczeń.`;
  }
  if (
    additionalMeanings.length > MAX_MEANINGS * 5 ||
    additionalMeanings.some((meaning) => meaning.length > MAX_TEXT_CHARS) ||
    meanings.join("|").length > MAX_MEANINGS_CHARS
  ) {
    return `Inne znaczenia są za długie (do ${String(MAX_TEXT_CHARS)} znaków każde, ${String(MAX_MEANINGS_CHARS)} łącznie).`;
  }
  return null;
}

/** True when no item that would be saved has a problem (see `itemProblem`). */
export function canAccept(draft: ReviewDraft): boolean {
  return draft.items.length > 0 && draft.items.every((item) => itemProblem(item) === null);
}

/** The body of `POST /api/proposal-sets`. */
export function toAcceptRequest(draft: ReviewDraft): AcceptRequestBody {
  return {
    tagName: draft.tagName,
    model: draft.model,
    items: draft.items.map(({ original, final, decision }) => {
      const { inCollection, ...proposal } = original;
      return {
        decision,
        original: proposal,
        inCollection,
        ...(decision === "accept" ? { final: inCollection ? contentOf(original) : final } : {}),
      };
    }),
  };
}

const contentSchema = z.object({
  word: z.string(),
  translation: z.string(),
  additionalMeanings: z.array(z.string()),
  exampleSentence: z.string(),
});

const draftV1Schema = z.object({
  version: z.literal(1),
  tagName: z.string().min(1),
  model: z.string(),
  createdAt: z.string(),
  items: z
    .array(
      z.object({
        original: contentSchema.extend({ cefr: z.enum(CEFR_LEVELS), inCollection: z.boolean() }),
        final: contentSchema,
        decision: z.enum(PROPOSAL_DECISIONS),
      }),
    )
    .min(1),
});

const draftSchema = draftV1Schema.extend({
  version: z.literal(DRAFT_VERSION),
  level: z.enum(CEFR_LEVELS).nullable(),
});

/**
 * Validates stored data. A version-1 draft (saved before levels existed) is upgraded with `level: null`, so a
 * review open during a deploy is kept; malformed data or any other version gives null.
 */
export function parseDraft(value: unknown): ReviewDraft | null {
  const parsed = draftSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  const legacy = draftV1Schema.safeParse(value);
  return legacy.success ? { ...legacy.data, version: DRAFT_VERSION, level: null } : null;
}

export function draftStorageKey(userId: string): string {
  return `lexio:review-draft:${userId}`;
}
