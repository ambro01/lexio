// Shared entity and input types for flashcards (service, API routes and UI).
// Type-only imports keep this module loadable by plain Node scripts.
import type { AiModelId } from "@/lib/ai/models";
import type { CefrLevel, Proposal } from "@/lib/ai/proposals";

export type { AiModelId, CefrLevel, Proposal };

export interface Tag {
  id: string;
  name: string;
}

export interface Flashcard {
  id: string;
  word: string;
  translation: string;
  additionalMeanings: string[];
  exampleSentence: string;
  cefr: CefrLevel | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

/** One page of the collection; `hasMore` is true when another page follows. */
export interface FlashcardPage {
  cards: Flashcard[];
  hasMore: boolean;
}

/** Input for "save the word, or add the tags if the word already exists" (FR-005). */
export interface SaveFlashcardInput {
  word: string;
  translation: string;
  additionalMeanings: string[];
  exampleSentence: string;
  cefr: CefrLevel | null;
  tagNames: string[];
}

/** Content fields that can be edited on an existing card; tags are not edited here. */
export type UpdateFlashcardInput = Partial<
  Pick<Flashcard, "word" | "translation" | "additionalMeanings" | "exampleSentence" | "cefr">
>;

/** The user's decision on one AI proposal during review; `reject_too_easy` is set only by the bulk "too easy" action. */
export type ProposalDecision = "accept" | "reject_known" | "reject_wrong" | "reject_too_easy";

/** Recorded outcome of one reviewed proposal; the values are a DB contract (`proposal_outcomes.outcome`). */
export type ProposalOutcome =
  "accepted_unchanged" | "accepted_corrected" | "rejected_wrong" | "rejected_known" | "rejected_too_easy";

/** The fields of a proposal the user can edit during review (CEFR is not editable). */
export type ProposalContent = Pick<Proposal, "word" | "translation" | "additionalMeanings" | "exampleSentence">;

/** A proposal as shown in review: `inCollection` marks a word the user already has. */
export type ReviewProposal = Proposal & { inCollection: boolean };

/** One item of an accepted set as stored by `accept_proposal_set`: final content plus its classified outcome. */
export type AcceptSetItem = ProposalContent & { cefr: CefrLevel | null; outcome: ProposalOutcome };

/** Where a set of outcomes came from; the values are a DB contract (`proposal_outcomes.source`). */
export type ProposalSource = "lesson" | "manual";

export interface AcceptProposalSetInput {
  /** `null` only for a manual save without a tag. */
  tagName: string | null;
  model: string;
  items: AcceptSetItem[];
  source: ProposalSource;
}

export interface AcceptSetResult {
  created: number;
  merged: number;
  rejected: number;
}

/** The user's settings (FR-014, FR-016); `null` means not set (no level, the default model). */
export interface Profile {
  cefrLevel: CefrLevel | null;
  aiModel: AiModelId | null;
}
