import { describe, expect, it } from "vitest";
import type { ReviewCard } from "@/types";
import {
  REVIEW_LIMIT_STORAGE_KEY,
  applyMastered,
  applyRating,
  currentCard,
  dropCurrent,
  isFinished,
  isMasteredResponse,
  isRateResponse,
  isReviewCard,
  isSessionResponse,
  parseLimit,
  progress,
  reveal,
  startSession,
  storedLimitOrDefault,
  summary,
} from "./session";

function card(id: string): ReviewCard {
  return {
    id,
    word: `word-${id}`,
    translation: `tłumaczenie-${id}`,
    additionalMeanings: [],
    exampleSentence: "",
    cefr: null,
    isNew: true,
    mastered: false,
    due: null,
  };
}

const ids = (cards: ReviewCard[]) => cards.map((c) => c.id);

describe("session queue", () => {
  it("starts on the first card, hidden", () => {
    const state = startSession([card("a"), card("b")]);
    expect(currentCard(state)?.id).toBe("a");
    expect(state.revealed).toBe(false);
    expect(progress(state)).toEqual({ current: 1, total: 2 });
    expect(isFinished(state)).toBe(false);
  });

  it("an empty session is finished at once", () => {
    const state = startSession([]);
    expect(isFinished(state)).toBe(true);
    expect(currentCard(state)).toBeNull();
    expect(summary(state)).toEqual({ reviewed: 0, again: 0, hard: 0, good: 0, mastered: 0 });
  });

  it("reveal shows the answer; a rating hides it for the next card", () => {
    const state = reveal(startSession([card("a"), card("b")]));
    expect(state.revealed).toBe(true);
    expect(applyRating(state, "good").revealed).toBe(false);
  });

  it('"again" appends the card to the end of the queue', () => {
    const state = applyRating(startSession([card("a"), card("b"), card("c")]), "again");
    expect(ids(state.queue)).toEqual(["b", "c", "a"]);
    expect(progress(state)).toEqual({ current: 2, total: 4 });
  });

  it('"hard" and "good" remove the card', () => {
    const afterHard = applyRating(startSession([card("a"), card("b")]), "hard");
    expect(ids(afterHard.queue)).toEqual(["b"]);
    const afterGood = applyRating(afterHard, "good");
    expect(isFinished(afterGood)).toBe(true);
  });

  it('"Opanowane" removes the card without a rating', () => {
    const state = applyMastered(startSession([card("a"), card("b")]));
    expect(ids(state.queue)).toEqual(["b"]);
    expect(summary(state)).toEqual({ reviewed: 0, again: 0, hard: 0, good: 0, mastered: 1 });
  });

  it("a dropped card counts nowhere", () => {
    const state = dropCurrent(startSession([card("a"), card("b")]));
    expect(ids(state.queue)).toEqual(["b"]);
    expect(summary(state)).toEqual({ reviewed: 0, again: 0, hard: 0, good: 0, mastered: 0 });
  });

  it("the summary counts each rating and each rated card once", () => {
    let state = startSession([card("a"), card("b"), card("c")]);
    state = applyRating(state, "again"); // a → end
    state = applyRating(state, "good"); // b
    state = applyMastered(state); // c
    state = applyRating(state, "again"); // a again → end
    expect(currentCard(state)?.id).toBe("a");
    state = applyRating(state, "hard"); // a
    expect(isFinished(state)).toBe(true);
    expect(summary(state)).toEqual({ reviewed: 2, again: 2, hard: 1, good: 1, mastered: 1 });
  });

  it("does nothing once finished", () => {
    const state = startSession([]);
    expect(applyRating(state, "good")).toBe(state);
    expect(applyMastered(state)).toBe(state);
    expect(reveal(state)).toBe(state);
  });
});

describe("session limit", () => {
  it("uses the documented storage key", () => {
    expect(REVIEW_LIMIT_STORAGE_KEY).toBe("lexio:review-limit");
  });

  it("accepts whole numbers 1–100 as numbers or strings", () => {
    expect(parseLimit(1)).toBe(1);
    expect(parseLimit("100")).toBe(100);
    expect(parseLimit(" 7 ")).toBe(7);
  });

  it("rejects anything else", () => {
    for (const value of [0, 101, 2.5, -1, "", "abc", "1e1x", null, undefined, Number.NaN, {}]) {
      expect(parseLimit(value)).toBeNull();
    }
  });

  it("falls back to 20 when nothing valid is stored", () => {
    expect(storedLimitOrDefault(null)).toBe(20);
    expect(storedLimitOrDefault("500")).toBe(20);
    expect(storedLimitOrDefault("junk")).toBe(20);
    expect(storedLimitOrDefault("35")).toBe(35);
  });
});

describe("response guards", () => {
  it("accepts a session response and rejects malformed cards", () => {
    expect(isSessionResponse({ cards: [card("a")] })).toBe(true);
    expect(isSessionResponse({ cards: [{ ...card("a"), isNew: "yes" }] })).toBe(false);
    expect(isReviewCard({ ...card("a"), due: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isReviewCard({ ...card("a"), additionalMeanings: [1] })).toBe(false);
  });

  it("accepts rate and mastered responses", () => {
    expect(isRateResponse({ due: "2026-01-01T00:00:00.000Z", state: 1 })).toBe(true);
    expect(isRateResponse({ due: null, state: 1 })).toBe(false);
    expect(isMasteredResponse({ mastered: true })).toBe(true);
    expect(isMasteredResponse({ mastered: "yes" })).toBe(false);
  });
});
