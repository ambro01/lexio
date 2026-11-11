// The review of one generated proposal set: every state transition is a pure function over a serialisable
// draft, so the UI can persist it to localStorage and the tests can run without React.
import { z } from "zod";
import { MAX_MEANINGS, MAX_MEANINGS_CHARS, MAX_TEXT_CHARS } from "@/lib/ai/limits";
import { CEFR_LEVELS } from "@/lib/ai/proposals";
import { classifyOutcome, normaliseContent, type AcceptRequestBody } from "@/lib/ai/outcomes";
import type { ProposalContent, ProposalDecision, ReviewProposal } from "@/types";

export const DRAFT_VERSION = 1;

export interface DraftItem {
  original: ReviewProposal;
  final: ProposalContent;
  decision: ProposalDecision;
}

export interface ReviewDraft {
  version: typeof DRAFT_VERSION;
  tagName: string;
  model: string;
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
  proposals: ReviewProposal[],
  now: Date = new Date(),
): ReviewDraft {
  return {
    version: DRAFT_VERSION,
    tagName,
    model,
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

export function counts(draft: ReviewDraft): { toSave: number; rejected: number } {
  const toSave = draft.items.filter((item) => item.decision === "accept").length;
  return { toSave, rejected: draft.items.length - toSave };
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

const draftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  tagName: z.string().min(1),
  model: z.string(),
  createdAt: z.string(),
  items: z
    .array(
      z.object({
        original: contentSchema.extend({ cefr: z.enum(CEFR_LEVELS), inCollection: z.boolean() }),
        final: contentSchema,
        decision: z.enum(["accept", "reject_known", "reject_wrong"]),
      }),
    )
    .min(1),
});

/** Validates stored data; malformed data or another draft version gives null. */
export function parseDraft(value: unknown): ReviewDraft | null {
  const parsed = draftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function draftStorageKey(userId: string): string {
  return `lexio:review-draft:${userId}`;
}
