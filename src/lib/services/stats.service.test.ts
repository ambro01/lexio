import { describe, expect, it } from "vitest";
import { FlashcardStoreError } from "./flashcards.service";
import { getQualityStats, type StatsClient } from "./stats.service";

interface Result {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface Call {
  method: string;
  args: unknown[];
}

/** Minimal stand-in for the Supabase client: records every call; the awaited RPC resolves to `result`. */
function stubClient(result: Result) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {
    then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  builder.overrideTypes = (...args: unknown[]) => {
    calls.push({ method: "overrideTypes", args });
    return builder;
  };
  const client = {
    rpc: (...args: unknown[]) => {
      calls.push({ method: "rpc", args });
      return builder;
    },
  };
  return { client: client as unknown as StatsClient, calls };
}

const row = (overrides: Record<string, unknown>) => ({
  source: "lesson",
  model: "model-a",
  outcome: "accepted_unchanged",
  recent: true,
  n: 1,
  ...overrides,
});

describe("getQualityStats", () => {
  it("calls proposal_outcome_stats with no arguments", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    await getQualityStats(client);
    expect(calls.find((call) => call.method === "rpc")?.args).toEqual(["proposal_outcome_stats"]);
  });

  it("maps rows, string counts included, into the quality figures", async () => {
    const { client } = stubClient({
      data: [
        row({ n: "3" }),
        row({ outcome: "accepted_corrected", n: 1 }),
        row({ outcome: "rejected_wrong", n: "1", recent: false }),
        row({ outcome: "rejected_known", n: "2" }),
        row({ model: null, outcome: "accepted_unchanged", n: "5", recent: false }),
        row({ source: "manual", model: "model-b", outcome: "accepted_corrected", n: "2" }),
      ],
      error: null,
    });
    const stats = await getQualityStats(client);
    expect(stats.hasData).toBe(true);
    expect(stats.lesson.all).toEqual({ rate: 9 / 10, rated: 10, unchangedShare: 8 / 9, accepted: 9 });
    expect(stats.lesson.recent).toEqual({ rate: 1, rated: 4, unchangedShare: 0.75, accepted: 4 });
    expect(stats.lessonByModel.map((entry) => [entry.model, entry.all.rated])).toEqual([
      ["model-a", 5],
      [null, 5],
    ]);
    expect(stats.manual.all).toEqual({ rate: 1, rated: 2, unchangedShare: 0, accepted: 2 });
    expect(stats.wordSelection.all).toEqual({ known: 2, tooEasy: 0 });
  });

  it("skips rows with an unknown source, outcome or count", async () => {
    const { client } = stubClient({
      data: [
        row({ n: 2 }),
        row({ source: "import", n: 7 }),
        row({ outcome: "accepted_later", n: 7 }),
        row({ n: "not a number" }),
      ],
      error: null,
    });
    const stats = await getQualityStats(client);
    expect(stats.lesson.all).toEqual({ rate: 1, rated: 2, unchangedShare: 1, accepted: 2 });
    expect(stats.manual.all.rated).toBe(0);
  });

  it("reports no data for an empty result", async () => {
    const { client } = stubClient({ data: [], error: null });
    const stats = await getQualityStats(client);
    expect(stats.hasData).toBe(false);
    expect(stats.lesson.all.rate).toBeNull();
  });

  it("throws FlashcardStoreError with the SQLSTATE only", async () => {
    const { client } = stubClient({ data: null, error: { code: "42501", message: "permission denied for secret" } });
    const failure = getQualityStats(client);
    await expect(failure).rejects.toBeInstanceOf(FlashcardStoreError);
    await expect(failure).rejects.toThrow(/^Stats outcome stats failed \(42501\)$/);
  });
});
