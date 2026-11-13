import { describe, expect, expectTypeOf, it } from "vitest";
import { REVIEW_RATINGS, type ReviewRating } from "./scheduler";
import {
  RATE_VALUES,
  REVIEW_LIMIT_DEFAULT,
  REVIEW_LIMIT_MAX,
  masteredRequestSchema,
  rateRequestSchema,
  sessionRequestSchema,
  type RateRequestBody,
} from "./requests";

const ID = "6f1c2b0e-3d4a-4b5c-8d9e-0a1b2c3d4e5f";

describe("RATE_VALUES", () => {
  it("lists exactly the scheduler's ratings", () => {
    expect([...RATE_VALUES]).toEqual([...REVIEW_RATINGS]);
    expectTypeOf<RateRequestBody["rating"]>().toEqualTypeOf<ReviewRating>();
  });
});

describe("sessionRequestSchema", () => {
  it("accepts a general session and a tag session", () => {
    expect(sessionRequestSchema.parse({ limit: REVIEW_LIMIT_DEFAULT })).toEqual({ limit: 20 });
    expect(sessionRequestSchema.parse({ tagId: ID, limit: 5 })).toEqual({ tagId: ID, limit: 5 });
  });

  it("accepts the limit bounds 1 and 100", () => {
    expect(sessionRequestSchema.safeParse({ limit: 1 }).success).toBe(true);
    expect(sessionRequestSchema.safeParse({ limit: REVIEW_LIMIT_MAX }).success).toBe(true);
  });

  it.each([0, 101, 2.5, "20", null])("rejects the limit %j", (limit) => {
    expect(sessionRequestSchema.safeParse({ limit }).success).toBe(false);
  });

  it("requires the limit", () => {
    expect(sessionRequestSchema.safeParse({}).success).toBe(false);
  });

  it.each(["not-a-uuid", "", null, 42])("rejects the tagId %j", (tagId) => {
    expect(sessionRequestSchema.safeParse({ tagId, limit: 20 }).success).toBe(false);
  });
});

describe("rateRequestSchema", () => {
  it.each(REVIEW_RATINGS)("accepts the rating %s", (rating) => {
    expect(rateRequestSchema.parse({ flashcardId: ID, rating })).toEqual({ flashcardId: ID, rating });
  });

  it.each(["easy", "Good", "", 3])("rejects the rating %j", (rating) => {
    expect(rateRequestSchema.safeParse({ flashcardId: ID, rating }).success).toBe(false);
  });

  it("rejects a malformed or missing flashcardId", () => {
    expect(rateRequestSchema.safeParse({ flashcardId: "card-1", rating: "good" }).success).toBe(false);
    expect(rateRequestSchema.safeParse({ rating: "good" }).success).toBe(false);
  });
});

describe("masteredRequestSchema", () => {
  it.each([true, false])("accepts %s", (mastered) => {
    expect(masteredRequestSchema.parse({ mastered })).toEqual({ mastered });
  });

  it.each(["true", 1, null, undefined])("rejects %j", (mastered) => {
    expect(masteredRequestSchema.safeParse({ mastered }).success).toBe(false);
  });
});
