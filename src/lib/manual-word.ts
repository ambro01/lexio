// The "Dodaj słowo" card (S-04): one AI fill under review, held in memory only. It reuses the lesson review's
// `DraftItem` shape, so `itemProblem` / `isEdited` and the review card apply unchanged.
import type { AcceptRequestBody } from "@/lib/ai/outcomes";
import type { DraftItem } from "@/lib/review-draft";
import type { ProposalContent, ReviewProposal } from "@/types";

/** A manual card is saved or discarded, never rejected, so its decision is always "accept". */
export type ManualItem = DraftItem & { decision: "accept" };

function contentOf(proposal: ReviewProposal): ProposalContent {
  return {
    word: proposal.word,
    translation: proposal.translation,
    additionalMeanings: [...proposal.additionalMeanings],
    exampleSentence: proposal.exampleSentence,
  };
}

/** A fresh card from the AI fill: the editable content starts as the AI's own. */
export function createManualItem(proposal: ReviewProposal): ManualItem {
  return { original: proposal, final: contentOf(proposal), decision: "accept" };
}

/** Restores the AI fill's content. */
export function revertManualItem(item: ManualItem): ManualItem {
  return { ...item, final: contentOf(item.original) };
}

/** True when the AI returned a different word than the user typed (base form, spelling or case). */
export function wasCorrected(typedWord: string, filledWord: string): boolean {
  return typedWord.replace(/\s+/g, " ").trim() !== filledWord.replace(/\s+/g, " ").trim();
}

/**
 * The body of `POST /api/proposal-sets` for a manual save. The original is the AI fill (never the typed word),
 * so the server classifies the outcome against what the AI returned. A blank tag means no tag.
 */
export function toManualAcceptRequest(item: ManualItem, tagName: string, model: string): AcceptRequestBody {
  const { word, translation, additionalMeanings, exampleSentence, cefr } = item.original;
  const tag = tagName.trim();
  return {
    source: "manual",
    tagName: tag === "" ? undefined : tag,
    model,
    items: [
      {
        decision: "accept",
        original: { word, translation, additionalMeanings, exampleSentence, cefr },
        inCollection: false,
        final: item.final,
      },
    ],
  };
}
