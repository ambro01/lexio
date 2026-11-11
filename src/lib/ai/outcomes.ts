// Business rules for reviewed proposals: what counts as "corrected", and the accept request contract.
// Pure (no astro:* imports), so the endpoint, the UI and the tests share one definition.
import { z } from "zod";
import {
  MAX_MEANINGS,
  MAX_MEANINGS_CHARS,
  MAX_SET_ITEMS,
  MAX_TAG_CHARS,
  MAX_TEXT_CHARS,
  MAX_WORD_CHARS,
} from "@/lib/ai/limits";
import { CEFR_LEVELS } from "@/lib/ai/proposals";
import type { AcceptSetItem, ProposalContent, ProposalDecision, ProposalOutcome, ProposalSource } from "@/types";

export { MAX_SET_ITEMS, MAX_TAG_CHARS, MAX_TEXT_CHARS, MAX_WORD_CHARS };

const MAX_MODEL_CHARS = 100;

/** Every review decision; the accept request and the stored draft accept exactly these. */
export const PROPOSAL_DECISIONS = [
  "accept",
  "reject_known",
  "reject_wrong",
  "reject_too_easy",
] as const satisfies readonly ProposalDecision[];

/** Where an accepted set comes from: a lesson review or a manually added word (S-04). */
export const PROPOSAL_SOURCES = ["lesson", "manual"] as const satisfies readonly ProposalSource[];

/** Collapses whitespace runs to one space and trims — the same rule the database uses for keys. */
function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseMeanings(meanings: string[]): string[] {
  return meanings.map(normaliseText).filter((meaning) => meaning !== "");
}

/** Whitespace-normalised content with blank additional meanings dropped. */
export function normaliseContent(content: ProposalContent): ProposalContent {
  return {
    word: normaliseText(content.word),
    translation: normaliseText(content.translation),
    additionalMeanings: normaliseMeanings(content.additionalMeanings),
    exampleSentence: normaliseText(content.exampleSentence),
  };
}

function sameContent(a: ProposalContent, b: ProposalContent): boolean {
  const left = normaliseContent(a);
  const right = normaliseContent(b);
  return (
    left.word === right.word &&
    left.translation === right.translation &&
    left.exampleSentence === right.exampleSentence &&
    left.additionalMeanings.length === right.additionalMeanings.length &&
    left.additionalMeanings.every((meaning, index) => meaning === right.additionalMeanings[index])
  );
}

/**
 * The primary-metric rule: an accepted proposal is "corrected" only if its content differs from the
 * AI original after whitespace normalisation (case-sensitive, meanings compared in order).
 */
export function classifyOutcome(
  decision: ProposalDecision,
  original: ProposalContent,
  final: ProposalContent,
): ProposalOutcome {
  switch (decision) {
    case "reject_known":
      return "rejected_known";
    case "reject_wrong":
      return "rejected_wrong";
    case "reject_too_easy":
      return "rejected_too_easy";
    case "accept":
      return sameContent(original, final) ? "accepted_unchanged" : "accepted_corrected";
  }
}

const textField = (min: number, max: number) => z.string().transform(normaliseText).pipe(z.string().min(min).max(max));

// The raw list may hold blank lines from the editor; the 10-item limit applies after they are dropped.
const meaningsField = z
  .array(z.string().max(MAX_TEXT_CHARS))
  .max(MAX_MEANINGS * 5)
  .transform(normaliseMeanings)
  .pipe(
    z
      .array(z.string())
      .max(MAX_MEANINGS)
      .refine((meanings) => meanings.join("|").length <= MAX_MEANINGS_CHARS),
  );

const contentSchema = z.object({
  word: textField(1, MAX_WORD_CHARS),
  translation: textField(1, MAX_TEXT_CHARS),
  additionalMeanings: meaningsField,
  exampleSentence: textField(0, MAX_TEXT_CHARS),
});

const originalSchema = contentSchema.extend({ cefr: z.enum(CEFR_LEVELS) });

const itemSchema = z
  .object({
    decision: z.enum(PROPOSAL_DECISIONS),
    original: originalSchema,
    inCollection: z.boolean(),
    final: contentSchema.optional(),
  })
  .refine((item) => item.decision !== "accept" || item.final !== undefined, {
    message: "final is required for an accepted proposal",
    path: ["final"],
  })
  // A word already in the collection is never "too easy" (isTooEasy): a "Za łatwe" record for it would make
  // S-09 hide a word the user is learning. The level part cannot be checked here (the server has no draft level).
  .refine((item) => item.decision !== "reject_too_easy" || !item.inCollection, {
    message: "a word already in the collection cannot be rejected as too easy",
    path: ["decision"],
  });

// Absent, null or blank → null ("no tag"); whether a tag is required depends on the source.
const tagNameField = z
  .string()
  .nullish()
  .transform((value) => normaliseText(value ?? ""))
  .pipe(z.string().max(MAX_TAG_CHARS))
  .transform((value) => (value === "" ? null : value));

/**
 * Body of `POST /api/proposal-sets`. Strings come out whitespace-normalised.
 * A lesson set (the default source) needs a tag and 1–150 items; a manual save is exactly 1 item, tag optional.
 */
export const acceptRequestSchema = z
  .object({
    source: z.enum(PROPOSAL_SOURCES).default("lesson"),
    tagName: tagNameField,
    model: z.string().max(MAX_MODEL_CHARS),
    items: z.array(itemSchema).min(1).max(MAX_SET_ITEMS),
  })
  .refine((request) => request.source !== "lesson" || request.tagName !== null, {
    message: "a lesson set needs a tag name",
    path: ["tagName"],
  })
  .refine((request) => request.source !== "manual" || request.items.length === 1, {
    message: "a manual save has exactly one item",
    path: ["items"],
  })
  // A manual card is saved or discarded, never rejected: a rejection marked "manual" would skew S-07.
  .refine((request) => request.source !== "manual" || request.items.every((item) => item.decision === "accept"), {
    message: "a manual save must accept its item",
    path: ["items"],
  });

/** What the client sends. */
export type AcceptRequestBody = z.input<typeof acceptRequestSchema>;
/** The validated, normalised request. */
export type AcceptRequest = z.output<typeof acceptRequestSchema>;

/**
 * Turns a validated request into the items `accept_proposal_set` stores: classifies each outcome,
 * keeps the AI original for `inCollection` items (they cannot be edited) and for rejected items.
 */
export function toAcceptSetItems(request: AcceptRequest): AcceptSetItem[] {
  return request.items.map(({ decision, original, inCollection, final }) => {
    const content = decision === "accept" && !inCollection && final ? final : original;
    return {
      word: content.word,
      translation: content.translation,
      additionalMeanings: content.additionalMeanings,
      exampleSentence: content.exampleSentence,
      cefr: original.cefr,
      outcome: classifyOutcome(decision, original, content),
    };
  });
}
