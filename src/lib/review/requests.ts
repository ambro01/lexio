// Request contracts of the review API (S-06): start a session, rate a card, toggle "Opanowane".
// Pure (no astro:* imports), so the endpoints, the review island and the tests share one definition. It must not
// import scheduler.ts at runtime: that pulls ts-fsrs into the browser bundle (the type import below is erased).
import { z } from "zod";
import { isUuid } from "@/lib/collection";
import type { ReviewRating } from "@/lib/review/scheduler";

/** Cards per session when the user has not chosen a number. */
export const REVIEW_LIMIT_DEFAULT = 20;
/** Most cards one session request returns (the `review_queue` bound). */
export const REVIEW_LIMIT_MAX = 100;

/** The ratings the API accepts; the same values as `REVIEW_RATINGS` in scheduler.ts (a test keeps them equal). */
export const RATE_VALUES = ["again", "hard", "good"] as const satisfies readonly ReviewRating[];

const uuidSchema = z.string().refine(isUuid);

/** Body of `POST /api/review/session`: no `tagId` is the general session; with one, every card of that tag. */
export const sessionRequestSchema = z.object({
  tagId: uuidSchema.optional(),
  limit: z.number().int().min(1).max(REVIEW_LIMIT_MAX),
});

export type SessionRequestBody = z.infer<typeof sessionRequestSchema>;

/** Body of `POST /api/review/rate`. */
export const rateRequestSchema = z.object({
  flashcardId: uuidSchema,
  rating: z.enum(RATE_VALUES),
});

export type RateRequestBody = z.infer<typeof rateRequestSchema>;

/** Body of `PUT /api/flashcards/[id]/mastered`. */
export const masteredRequestSchema = z.object({ mastered: z.boolean() });

export type MasteredRequestBody = z.infer<typeof masteredRequestSchema>;
