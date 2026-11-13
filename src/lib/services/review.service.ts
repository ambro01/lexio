import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/ai/proposals";
import {
  emptyReviewState,
  fromReviewStateRow,
  scheduleReview,
  toGrade,
  toReviewStateRow,
  type ReviewRating,
  type ReviewState,
} from "@/lib/review/scheduler";
import { FlashcardNotFoundError, FlashcardStoreError } from "@/lib/services/flashcards.service";
import type { ReviewCard } from "@/types";

export type ReviewClient = SupabaseClient<Database>;

/** Thrown when the card's review state changed between reading and writing it (a double submit or a second tab). */
export class ReviewConflictError extends Error {
  override name = "ReviewConflictError";
}

const NO_DATA_FOUND = "P0002";
const SERIALIZATION_FAILURE = "40001";

const STATE_SELECT = "due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review";

interface PostgrestErrorLike {
  code?: string;
}

/** Maps an RPC/query error by SQLSTATE only; the message never contains user content. */
function reviewError(operation: string, error: PostgrestErrorLike): Error {
  if (error.code === NO_DATA_FOUND) {
    return new FlashcardNotFoundError("Flashcard not found");
  }
  if (error.code === SERIALIZATION_FAILURE) {
    return new ReviewConflictError("Review state changed since it was read");
  }
  return new FlashcardStoreError(`Review ${operation} failed${error.code ? ` (${error.code})` : ""}`);
}

function toCefr(value: string | null): CefrLevel | null {
  return CEFR_LEVELS.find((level) => level === value) ?? null;
}

// review_queue leaves due and state null for a card without a state row; the generated types mark them non-null.
interface ReviewQueueRow {
  id: string;
  word: string;
  translation: string;
  additional_meanings: string[];
  example_sentence: string;
  cefr: string | null;
  due: string | null;
  state: number | null;
  mastered: boolean;
}

function toReviewCard(row: ReviewQueueRow): ReviewCard {
  return {
    id: row.id,
    word: row.word,
    translation: row.translation,
    additionalMeanings: row.additional_meanings,
    exampleSentence: row.example_sentence,
    cefr: toCefr(row.cefr),
    isNew: row.state === null || row.state === 0,
    mastered: row.mastered,
    due: row.due === null ? null : new Date(row.due).toISOString(),
  };
}

/**
 * The review queue: without a tag, non-mastered due cards (oldest due first) then new cards (oldest first);
 * with a tag, every card of the tag (mastered included): due, then new, then the rest. At most `limit` (1-100).
 */
export async function loadReviewQueue(
  client: ReviewClient,
  { tagId, limit }: { tagId?: string; limit: number },
): Promise<ReviewCard[]> {
  const { data, error } = await client
    .rpc("review_queue", { p_limit: limit, ...(tagId === undefined ? {} : { p_tag_id: tagId }) })
    .overrideTypes<ReviewQueueRow[], { merge: false }>();
  if (error) {
    throw reviewError("queue", error);
  }
  return data.map(toReviewCard);
}

/**
 * Rates a card: reads its state (none for a new card), computes the next one with FSRS and stores it with a log
 * row. `ReviewConflictError` when another rating was stored in between; `FlashcardNotFoundError` when the card
 * is missing or another user's.
 */
export async function rateCard(
  client: ReviewClient,
  flashcardId: string,
  rating: ReviewRating,
  now: Date,
): Promise<ReviewState> {
  const { data: row, error: readError } = await client
    .from("review_states")
    .select(STATE_SELECT)
    .eq("flashcard_id", flashcardId)
    .maybeSingle();
  if (readError) {
    throw reviewError("state read", readError);
  }

  const next = scheduleReview(row ? fromReviewStateRow(row) : null, rating, now);
  const { error } = await client.rpc("record_review", {
    p_flashcard_id: flashcardId,
    // The SQL parameter accepts null (no state row yet); the generated type marks every function argument as non-null.
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- null is passed through
    p_expected_reps: (row ? row.reps : null) as number,
    p_rating: toGrade(rating),
    p_state: { ...toReviewStateRow(next) },
  });
  if (error) {
    throw reviewError("rating", error);
  }
  return next;
}

/** Marks a card as mastered ("Opanowane") or not; its FSRS state is kept, and a never-reviewed card stays new. */
export async function setMastered(
  client: ReviewClient,
  flashcardId: string,
  mastered: boolean,
  now: Date,
): Promise<void> {
  const { error } = await client.rpc("set_flashcard_mastered", {
    p_flashcard_id: flashcardId,
    p_mastered: mastered,
    p_empty_state: { ...toReviewStateRow(emptyReviewState(now)) },
  });
  if (error) {
    throw reviewError("mastered update", error);
  }
}
