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

/**
 * The review notice for proposals skipped as known, or null when none were skipped.
 * `remaining` is the number of proposals left after the filter; with none left the text replaces the empty-state notice.
 */
export function skippedNotice(skipped: number, remaining: number): string | null {
  if (skipped <= 0) {
    return null;
  }
  const count = String(skipped);
  return remaining > 0
    ? `Pominięto ${count} znanych słów`
    : `AI nie znalazło nowych słów — pominięto ${count} znanych.`;
}
