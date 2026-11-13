import { describe, expect, it } from "vitest";
import { scheduleReview, toReviewStateRow, type ReviewStateRow } from "@/lib/review/scheduler";
import { FlashcardNotFoundError, FlashcardStoreError } from "./flashcards.service";
import { ReviewConflictError, loadReviewQueue, rateCard, setMastered, type ReviewClient } from "./review.service";

interface Result {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface Call {
  method: string;
  args: unknown[];
}

/**
 * Minimal stand-in for the Supabase client: records every call; each awaited query or RPC resolves to the next
 * of `results` (the last one repeats).
 */
function stubClient(...results: Result[]) {
  const calls: Call[] = [];
  let next = 0;
  const take = () => results[Math.min(next++, results.length - 1)];
  const chain = (): Record<string, unknown> => {
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown) => Promise.resolve(take()).then(resolve),
    };
    for (const method of ["select", "eq", "maybeSingle", "overrideTypes"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    return builder;
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return chain();
    },
    rpc: (fn: string, params: unknown) => {
      calls.push({ method: "rpc", args: [fn, params] });
      return chain();
    },
  };
  return { client: client as unknown as ReviewClient, calls };
}

const NOW = new Date("2026-11-13T10:00:00.000Z");

const queueRow = {
  id: "card-1",
  word: "give up",
  translation: "poddać się",
  additional_meanings: ["zrezygnować"],
  example_sentence: "Don't give up.",
  cefr: "B1",
  due: "2026-11-12T10:00:00+00:00",
  state: 2,
  mastered: false,
};

const storedState: ReviewStateRow = {
  due: "2026-11-12T10:00:00.000Z",
  stability: 3.2,
  difficulty: 5.1,
  scheduled_days: 3,
  learning_steps: 0,
  reps: 4,
  lapses: 1,
  state: 2,
  last_review: "2026-11-09T10:00:00.000Z",
};

function rpcCall(calls: Call[]) {
  return calls.find((call) => call.method === "rpc")?.args;
}

describe("loadReviewQueue", () => {
  it("calls review_queue with the limit only in general mode", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    await loadReviewQueue(client, { limit: 20 });
    expect(rpcCall(calls)).toEqual(["review_queue", { p_limit: 20 }]);
  });

  it("passes the tag id in tag mode", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    await loadReviewQueue(client, { tagId: "tag-1", limit: 5 });
    expect(rpcCall(calls)).toEqual(["review_queue", { p_limit: 5, p_tag_id: "tag-1" }]);
  });

  it("maps rows to review cards", async () => {
    const { client } = stubClient({
      data: [
        queueRow,
        { ...queueRow, id: "card-2", cefr: null, due: null, state: null, mastered: false },
        { ...queueRow, id: "card-3", cefr: "Z9", state: 0, mastered: true },
      ],
      error: null,
    });

    const cards = await loadReviewQueue(client, { limit: 20 });

    expect(cards[0]).toEqual({
      id: "card-1",
      word: "give up",
      translation: "poddać się",
      additionalMeanings: ["zrezygnować"],
      exampleSentence: "Don't give up.",
      cefr: "B1",
      isNew: false,
      mastered: false,
      due: "2026-11-12T10:00:00.000Z",
    });
    expect(cards[1]).toMatchObject({ id: "card-2", cefr: null, isNew: true, due: null });
    expect(cards[2]).toMatchObject({ id: "card-3", cefr: null, isNew: true, mastered: true });
  });

  it("maps an error to FlashcardStoreError without user content", async () => {
    const { client } = stubClient({ data: null, error: { code: "22023", message: "limit 500" } });
    const promise = loadReviewQueue(client, { limit: 500 });
    await expect(promise).rejects.toBeInstanceOf(FlashcardStoreError);
    await expect(promise).rejects.not.toThrow("limit 500");
  });
});

describe("rateCard", () => {
  it("reads the state, schedules from it and records with the read reps", async () => {
    const { client, calls } = stubClient({ data: storedState, error: null }, { data: null, error: null });

    const next = await rateCard(client, "card-1", "good", NOW);

    expect(calls.slice(0, 4).map((call) => call.method)).toEqual(["from", "select", "eq", "maybeSingle"]);
    expect(calls[0].args).toEqual(["review_states"]);
    expect(calls[2].args).toEqual(["flashcard_id", "card-1"]);
    expect(next.reps).toBe(5);
    expect(next.lastReview).toEqual(NOW);
    expect(rpcCall(calls)).toEqual([
      "record_review",
      { p_flashcard_id: "card-1", p_expected_reps: 4, p_rating: 3, p_state: toReviewStateRow(next) },
    ]);
  });

  it("starts a card without a state from the empty card and sends null expected reps", async () => {
    const { client, calls } = stubClient({ data: null, error: null });

    const next = await rateCard(client, "card-1", "again", NOW);

    expect(next).toEqual(scheduleReview(null, "again", NOW));
    expect(next.reps).toBe(1);
    expect(rpcCall(calls)).toEqual([
      "record_review",
      { p_flashcard_id: "card-1", p_expected_reps: null, p_rating: 1, p_state: toReviewStateRow(next) },
    ]);
  });

  it("maps 40001 to ReviewConflictError", async () => {
    const { client } = stubClient({ data: storedState, error: null }, { data: null, error: { code: "40001" } });
    await expect(rateCard(client, "card-1", "hard", NOW)).rejects.toBeInstanceOf(ReviewConflictError);
  });

  it("maps P0002 to FlashcardNotFoundError", async () => {
    const { client } = stubClient({ data: null, error: null }, { data: null, error: { code: "P0002" } });
    await expect(rateCard(client, "card-1", "good", NOW)).rejects.toBeInstanceOf(FlashcardNotFoundError);
  });

  it("maps a failed state read to FlashcardStoreError and records nothing", async () => {
    const { client, calls } = stubClient({ data: null, error: { code: "42501" } });
    await expect(rateCard(client, "card-1", "good", NOW)).rejects.toBeInstanceOf(FlashcardStoreError);
    expect(rpcCall(calls)).toBeUndefined();
  });
});

describe("setMastered", () => {
  it("calls set_flashcard_mastered with the empty state", async () => {
    const { client, calls } = stubClient({ data: null, error: null });

    await setMastered(client, "card-1", true, NOW);

    expect(rpcCall(calls)).toEqual([
      "set_flashcard_mastered",
      {
        p_flashcard_id: "card-1",
        p_mastered: true,
        p_empty_state: {
          due: NOW.toISOString(),
          stability: 0,
          difficulty: 0,
          scheduled_days: 0,
          learning_steps: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          last_review: null,
        },
      },
    ]);
  });

  it("maps P0002 to FlashcardNotFoundError", async () => {
    const { client } = stubClient({ data: null, error: { code: "P0002" } });
    await expect(setMastered(client, "card-1", false, NOW)).rejects.toBeInstanceOf(FlashcardNotFoundError);
  });

  it("maps another error to FlashcardStoreError", async () => {
    const { client } = stubClient({ data: null, error: { code: "42501" } });
    await expect(setMastered(client, "card-1", false, NOW)).rejects.toBeInstanceOf(FlashcardStoreError);
  });
});
