// Queue state of one review session (S-06) and the stored session limit — the pure part of the "Powtórka" island.
// No React and no fetch, so the tests run without a browser. It must not import scheduler.ts at runtime: that
// pulls ts-fsrs into the browser bundle (the API does all FSRS work).
import { REVIEW_LIMIT_DEFAULT, REVIEW_LIMIT_MAX, type RateRequestBody } from "@/lib/review/requests";
import { isRecord } from "@/lib/utils";
import type { ReviewCard } from "@/types";

export type SessionRating = RateRequestBody["rating"];

/** localStorage key of the last chosen session limit. */
export const REVIEW_LIMIT_STORAGE_KEY = "lexio:review-limit";

export interface SessionCounts {
  again: number;
  hard: number;
  good: number;
  mastered: number;
}

export interface SessionState {
  /** Cards still to show; the first one is on screen. */
  queue: ReviewCard[];
  /** Whether the answer of the current card is shown. */
  revealed: boolean;
  /** Cards that left the screen so far (a card rated "again" counts once per showing). */
  shown: number;
  /** Ids of the cards rated at least once, in rating order. */
  ratedIds: string[];
  counts: SessionCounts;
}

export interface SessionSummary extends SessionCounts {
  /** Distinct cards rated at least once. */
  reviewed: number;
}

export function startSession(cards: readonly ReviewCard[]): SessionState {
  return {
    queue: [...cards],
    revealed: false,
    shown: 0,
    ratedIds: [],
    counts: { again: 0, hard: 0, good: 0, mastered: 0 },
  };
}

export function currentCard(state: SessionState): ReviewCard | null {
  return state.queue[0] ?? null;
}

export function isFinished(state: SessionState): boolean {
  return state.queue.length === 0;
}

export function reveal(state: SessionState): SessionState {
  return isFinished(state) ? state : { ...state, revealed: true };
}

/** "Karta X / Y": Y grows by one each time a card rated "again" goes back to the end of the queue. */
export function progress(state: SessionState): { current: number; total: number } {
  return { current: state.shown + 1, total: state.shown + state.queue.length };
}

/**
 * The current card got a rating: "again" moves it to the end of the queue, "hard" and "good" remove it.
 * A re-queued card is no longer new: it now has a review state.
 */
export function applyRating(state: SessionState, rating: SessionRating): SessionState {
  const card = currentCard(state);
  if (card === null) {
    return state;
  }
  const rest = state.queue.slice(1);
  return {
    queue: rating === "again" ? [...rest, { ...card, isNew: false }] : rest,
    revealed: false,
    shown: state.shown + 1,
    ratedIds: state.ratedIds.includes(card.id) ? state.ratedIds : [...state.ratedIds, card.id],
    counts: { ...state.counts, [rating]: state.counts[rating] + 1 },
  };
}

/** The current card was marked "Opanowane": it leaves the queue without a rating. */
export function applyMastered(state: SessionState): SessionState {
  return leave(state, { ...state.counts, mastered: state.counts.mastered + 1 });
}

/** The current card no longer exists (deleted elsewhere): it leaves the queue and counts nowhere. */
export function dropCurrent(state: SessionState): SessionState {
  return leave(state, state.counts);
}

function leave(state: SessionState, counts: SessionCounts): SessionState {
  if (isFinished(state)) {
    return state;
  }
  return { ...state, queue: state.queue.slice(1), revealed: false, shown: state.shown + 1, counts };
}

export function summary(state: SessionState): SessionSummary {
  return { reviewed: state.ratedIds.length, ...state.counts };
}

/** A whole number of cards within 1–100, or null. */
export function parseLimit(value: unknown): number | null {
  const limit = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof limit === "number" && Number.isInteger(limit) && limit >= 1 && limit <= REVIEW_LIMIT_MAX ? limit : null;
}

/** The stored session limit, or the default when nothing valid is stored. */
export function storedLimitOrDefault(raw: string | null): number {
  return parseLimit(raw) ?? REVIEW_LIMIT_DEFAULT;
}

export function isReviewCard(body: unknown): body is ReviewCard {
  return (
    isRecord(body) &&
    typeof body.id === "string" &&
    typeof body.word === "string" &&
    typeof body.translation === "string" &&
    Array.isArray(body.additionalMeanings) &&
    body.additionalMeanings.every((meaning) => typeof meaning === "string") &&
    typeof body.exampleSentence === "string" &&
    (body.cefr === null || typeof body.cefr === "string") &&
    typeof body.isNew === "boolean" &&
    typeof body.mastered === "boolean" &&
    (body.due === null || typeof body.due === "string")
  );
}

export function isSessionResponse(body: unknown): body is { cards: ReviewCard[] } {
  return isRecord(body) && Array.isArray(body.cards) && body.cards.every(isReviewCard);
}

export function isRateResponse(body: unknown): body is { due: string; state: number } {
  return isRecord(body) && typeof body.due === "string" && typeof body.state === "number";
}

export function isMasteredResponse(body: unknown): body is { mastered: boolean } {
  return isRecord(body) && typeof body.mastered === "boolean";
}
