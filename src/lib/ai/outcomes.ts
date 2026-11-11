// Business rules for reviewed proposals: what counts as "corrected", and the accept request contract.
// Pure (no astro:* imports), so the endpoint, the UI and the tests share one definition.
import { z } from "zod";
import { CEFR_LEVELS } from "@/lib/ai/proposals";
import type { AcceptSetItem, ProposalContent, ProposalDecision, ProposalOutcome } from "@/types";

export const MAX_SET_ITEMS = 150;

// Limits mirror the database checks (see 20261110221827_flashcard_key_folding.sql); the review UI reuses them.
export const MAX_WORD_CHARS = 100;
export const MAX_TEXT_CHARS = 500;
const MAX_MEANINGS = 10;
const MAX_MEANINGS_CHARS = 2000;
export const MAX_TAG_CHARS = 50;
const MAX_MODEL_CHARS = 100;

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
    decision: z.enum(["accept", "reject_known", "reject_wrong"]),
    original: originalSchema,
    inCollection: z.boolean(),
    final: contentSchema.optional(),
  })
  .refine((item) => item.decision !== "accept" || item.final !== undefined, {
    message: "final is required for an accepted proposal",
    path: ["final"],
  });

/** Body of `POST /api/proposal-sets`. Strings come out whitespace-normalised. */
export const acceptRequestSchema = z.object({
  tagName: textField(1, MAX_TAG_CHARS),
  model: z.string().max(MAX_MODEL_CHARS),
  items: z.array(itemSchema).min(1).max(MAX_SET_ITEMS),
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
