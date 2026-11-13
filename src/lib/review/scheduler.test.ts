import { describe, expect, it } from "vitest";
import {
  REVIEW_RATINGS,
  createScheduler,
  emptyReviewState,
  fromReviewStateRow,
  scheduleReview,
  toGrade,
  toReviewStateRow,
  type ReviewState,
  type ReviewStateRow,
} from "./scheduler";

const NOW = new Date("2026-11-13T10:00:00.000Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Exact intervals need the fuzz off; production fuzzes review intervals.
const exactSchedule = createScheduler({ enableFuzz: false });

/** A card in the review state (2): "good" twice through the learning steps. */
function reviewCard(): { state: ReviewState; at: Date } {
  const first = exactSchedule(null, "good", NOW);
  const second = exactSchedule(first, "good", first.due);
  return { state: second, at: second.due };
}

describe("rating mapping", () => {
  it("maps again, hard and good to FSRS ratings 1, 2 and 3", () => {
    expect(REVIEW_RATINGS).toEqual(["again", "hard", "good"]);
    expect(REVIEW_RATINGS.map(toGrade)).toEqual([1, 2, 3]);
  });
});

describe("scheduleReview", () => {
  it("turns a card without a state into a learning card due within minutes after 'again'", () => {
    const next = scheduleReview(null, "again", NOW);

    expect(next.state).toBe(1);
    expect(next.reps).toBe(1);
    expect(next.lastReview).toEqual(NOW);
    expect(next.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.due.getTime() - NOW.getTime()).toBeLessThanOrEqual(10 * MINUTE);
  });

  it("reaches the review state after two 'good' answers", () => {
    const { state } = reviewCard();
    expect(state.state).toBe(2);
    expect(state.scheduledDays).toBeGreaterThanOrEqual(1);
  });

  it("schedules 'good' on a review card further out than 'hard'", () => {
    const { state, at } = reviewCard();
    const later = new Date(at.getTime() + 3 * DAY);

    const hard = exactSchedule(state, "hard", later);
    const good = exactSchedule(state, "good", later);

    expect(good.due.getTime()).toBeGreaterThan(hard.due.getTime());
    expect(good.scheduledDays).toBeGreaterThan(hard.scheduledDays);
  });

  it("keeps fuzzed intervals near the exact ones", () => {
    const { state, at } = reviewCard();
    const later = new Date(at.getTime() + 3 * DAY);
    const exact = exactSchedule(state, "good", later).scheduledDays;
    const fuzzed = scheduleReview(state, "good", later).scheduledDays;

    expect(fuzzed).toBeGreaterThanOrEqual(Math.floor(exact * 0.75));
    expect(fuzzed).toBeLessThanOrEqual(Math.ceil(exact * 1.25));
  });

  it("counts a lapse when a review card is forgotten", () => {
    const { state, at } = reviewCard();
    const next = exactSchedule(state, "again", new Date(at.getTime() + DAY));
    expect(next.state).toBe(3);
    expect(next.lapses).toBe(1);
  });

  it("runs 1,000 schedules well under 1,000 ms", () => {
    const { state, at } = reviewCard();
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      scheduleReview(i % 2 === 0 ? state : null, REVIEW_RATINGS[i % 3], new Date(at.getTime() + i * MINUTE));
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe("emptyReviewState", () => {
  it("is a new card due now with no reviews", () => {
    const empty = emptyReviewState(NOW);
    expect(empty).toEqual({
      due: NOW,
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      lastReview: null,
    });
  });
});

describe("row round-trip", () => {
  it("preserves every value through the stored shape", () => {
    const { state } = reviewCard();
    const row = toReviewStateRow(state);

    expect(row.due).toBe(state.due.toISOString());
    expect(row.last_review).toBe(state.lastReview?.toISOString());
    expect(fromReviewStateRow(row)).toEqual(state);
    expect(fromReviewStateRow(toReviewStateRow(emptyReviewState(NOW)))).toEqual(emptyReviewState(NOW));
  });

  it("schedules the same from a round-tripped state as from the original", () => {
    const { state, at } = reviewCard();
    const later = new Date(at.getTime() + 2 * DAY);
    const restored = fromReviewStateRow(JSON.parse(JSON.stringify(toReviewStateRow(state))) as ReviewStateRow);
    expect(exactSchedule(restored, "good", later)).toEqual(exactSchedule(state, "good", later));
  });
});
