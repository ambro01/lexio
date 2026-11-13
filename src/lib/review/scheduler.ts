// The only module that knows FSRS (ts-fsrs): the rating mapping, the conversion between the stored state and a
// ts-fsrs card, and computing the next state. Pure — the caller passes `now` — so tests use fixed dates.
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type FSRS, type Grade } from "ts-fsrs";

/** API values of the three answer buttons: "Nie pamiętam", "Trudne", "Łatwe". */
export const REVIEW_RATINGS = ["again", "hard", "good"] as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[number];

const GRADES: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
};

/** The FSRS grade of a rating; its numeric value (1, 2, 3) is what `review_log.rating` stores. */
export function toGrade(rating: ReviewRating): Grade {
  return GRADES[rating];
}

/** camelCase mirror of the FSRS columns of `review_states`. `state`: 0 new, 1 learning, 2 review, 3 relearning. */
export interface ReviewState {
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

/** The stored shape of a state: the `review_states` columns, and the JSON `record_review` takes as `p_state`. */
export interface ReviewStateRow {
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

export function toReviewStateRow(state: ReviewState): ReviewStateRow {
  return {
    due: state.due.toISOString(),
    stability: state.stability,
    difficulty: state.difficulty,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.lastReview ? state.lastReview.toISOString() : null,
  };
}

export function fromReviewStateRow(row: ReviewStateRow): ReviewState {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    scheduledDays: row.scheduled_days,
    learningSteps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReview: row.last_review === null ? null : new Date(row.last_review),
  };
}

function fromCard(card: Card): ReviewState {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}

function toCard(state: ReviewState): Card {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    // Deprecated in ts-fsrs 5; `next` derives the elapsed time from last_review.
    elapsed_days: 0,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.lastReview ?? undefined,
  };
}

/** The starting state of a card that was never reviewed (also stored when such a card is marked "Opanowane"). */
export function emptyReviewState(now: Date): ReviewState {
  return fromCard(createEmptyCard(now));
}

export type ScheduleReview = (state: ReviewState | null, rating: ReviewRating, now: Date) => ReviewState;

/** Builds a scheduler on FSRS defaults. Production fuzzes intervals; tests asserting exact intervals turn it off. */
export function createScheduler({ enableFuzz }: { enableFuzz: boolean }): ScheduleReview {
  const scheduler: FSRS = fsrs(generatorParameters({ enable_fuzz: enableFuzz }));
  return (state, rating, now) => {
    const card = state ? toCard(state) : createEmptyCard(now);
    return fromCard(scheduler.next(card, now, toGrade(rating)).card);
  };
}

/** The next state after `rating` at `now`; a card without a state starts from the empty card. */
export const scheduleReview: ScheduleReview = createScheduler({ enableFuzz: true });
