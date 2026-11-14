import { toKey } from "@/lib/ai/word-key";

/**
 * Drops proposals whose word the user once rejected as known or too easy (FR-015), keeping the order.
 * Words are compared by `toKey`, so case and whitespace variants count as the same word.
 */
export function dropKnownWords<T extends { word: string }>(
  proposals: T[],
  knownKeys: Set<string>,
): { kept: T[]; skipped: number } {
  const kept = proposals.filter((proposal) => !knownKeys.has(toKey(proposal.word)));
  return { kept, skipped: proposals.length - kept.length };
}
