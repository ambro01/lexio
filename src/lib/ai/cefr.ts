// The single definition of a "too easy" proposal (FR-014). Pure, so the draft, the UI and the tests share it.
import { CEFR_LEVELS, type CefrLevel } from "@/lib/ai/proposals";

/**
 * True when the user has a level, the word is not already in their collection, and the AI's CEFR estimate
 * is strictly below that level (in `CEFR_LEVELS` order).
 */
export function isTooEasy(proposal: { cefr: CefrLevel; inCollection: boolean }, level: CefrLevel | null): boolean {
  if (level === null || proposal.inCollection) {
    return false;
  }
  return CEFR_LEVELS.indexOf(proposal.cefr) < CEFR_LEVELS.indexOf(level);
}
