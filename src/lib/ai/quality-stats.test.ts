import { describe, expect, it } from "vitest";
import { buildQualityStats, qualityRate, type OutcomeCount } from "./quality-stats";

function count(
  outcome: OutcomeCount["outcome"],
  n: number,
  { source = "lesson", model = "model-a", recent = true }: Partial<Omit<OutcomeCount, "outcome" | "n">> = {},
): OutcomeCount {
  return { source, model, outcome, recent, n };
}

describe("qualityRate", () => {
  it("applies the PRD formula to a mixed set", () => {
    const result = qualityRate([
      count("accepted_unchanged", 6),
      count("accepted_corrected", 2),
      count("rejected_wrong", 2),
    ]);
    expect(result).toEqual({ rate: 0.8, rated: 10, unchangedShare: 0.75, accepted: 8 });
  });

  it("ignores known and too-easy outcomes", () => {
    const result = qualityRate([
      count("accepted_unchanged", 3),
      count("rejected_wrong", 1),
      count("rejected_known", 50),
      count("rejected_too_easy", 40),
    ]);
    expect(result).toEqual({ rate: 0.75, rated: 4, unchangedShare: 1, accepted: 3 });
  });

  it("returns null rates when nothing was rated", () => {
    expect(qualityRate([])).toEqual({ rate: null, rated: 0, unchangedShare: null, accepted: 0 });
    expect(qualityRate([count("rejected_known", 5), count("rejected_too_easy", 2)])).toEqual({
      rate: null,
      rated: 0,
      unchangedShare: null,
      accepted: 0,
    });
  });

  it("returns a 0 rate and a null unchanged share when every rated proposal was wrong", () => {
    expect(qualityRate([count("rejected_wrong", 3)])).toEqual({
      rate: 0,
      rated: 3,
      unchangedShare: null,
      accepted: 0,
    });
  });

  it("sums several rows with the same outcome (merged accepts arrive as accepted_*)", () => {
    // accept_proposal_set records a merged accept as accepted_unchanged / accepted_corrected like any other.
    const result = qualityRate([
      count("accepted_unchanged", 2, { recent: true }),
      count("accepted_unchanged", 1, { recent: false }),
      count("accepted_corrected", 1, { model: "model-b" }),
    ]);
    expect(result).toEqual({ rate: 1, rated: 4, unchangedShare: 0.75, accepted: 4 });
  });
});

describe("buildQualityStats", () => {
  it("splits the last 30 days from all time", () => {
    const stats = buildQualityStats([
      count("accepted_unchanged", 3, { recent: true }),
      count("rejected_wrong", 1, { recent: true }),
      count("accepted_corrected", 4, { recent: false }),
      count("rejected_wrong", 2, { recent: false }),
    ]);
    expect(stats.lesson.recent).toEqual({ rate: 0.75, rated: 4, unchangedShare: 1, accepted: 3 });
    expect(stats.lesson.all).toEqual({ rate: 0.7, rated: 10, unchangedShare: 3 / 7, accepted: 7 });
  });

  it("counts known and too-easy in the word selection, per period, and not in the rate", () => {
    const stats = buildQualityStats([
      count("accepted_unchanged", 1),
      count("rejected_known", 4, { recent: true }),
      count("rejected_known", 2, { recent: false }),
      count("rejected_too_easy", 3, { recent: false }),
    ]);
    expect(stats.wordSelection).toEqual({ all: { known: 6, tooEasy: 3 }, recent: { known: 4, tooEasy: 0 } });
    expect(stats.lesson.all.rated).toBe(1);
  });

  it("groups lesson figures by model, a null model included, most rated first then by name", () => {
    const stats = buildQualityStats([
      count("accepted_unchanged", 1, { model: "zeta" }),
      count("accepted_unchanged", 2, { model: null }),
      count("rejected_wrong", 2, { model: null, recent: false }),
      count("accepted_unchanged", 1, { model: "alpha" }),
      count("accepted_unchanged", 1, { model: "beta" }),
      count("rejected_known", 9, { model: "beta" }),
    ]);
    expect(stats.lessonByModel.map((row) => row.model)).toEqual([null, "alpha", "beta", "zeta"]);
    expect(stats.lessonByModel[0]).toEqual({
      model: null,
      all: { rate: 0.5, rated: 4, unchangedShare: 1, accepted: 2 },
      recent: { rate: 1, rated: 2, unchangedShare: 1, accepted: 2 },
    });
  });

  it("puts the unknown model after named models with the same rated count", () => {
    const stats = buildQualityStats([
      count("accepted_unchanged", 1, { model: null }),
      count("accepted_unchanged", 1, { model: "alpha" }),
    ]);
    expect(stats.lessonByModel.map((row) => row.model)).toEqual(["alpha", null]);
  });

  it("keeps manual outcomes apart from lesson figures and word selection", () => {
    const stats = buildQualityStats([
      count("accepted_unchanged", 3),
      count("accepted_corrected", 1, { source: "manual" }),
      count("accepted_unchanged", 1, { source: "manual", recent: false }),
    ]);
    expect(stats.lesson.all).toEqual({ rate: 1, rated: 3, unchangedShare: 1, accepted: 3 });
    expect(stats.manual.all).toEqual({ rate: 1, rated: 2, unchangedShare: 0.5, accepted: 2 });
    expect(stats.manual.recent).toEqual({ rate: 1, rated: 1, unchangedShare: 0, accepted: 1 });
    expect(stats.lessonByModel).toHaveLength(1);
    expect(stats.lessonByModel[0].all.rated).toBe(3);
  });

  it("reports no data for no counts, and data when only word-selection outcomes exist", () => {
    const empty = buildQualityStats([]);
    expect(empty.hasData).toBe(false);
    expect(empty.lesson.all.rate).toBeNull();
    expect(empty.manual.recent.rate).toBeNull();
    expect(empty.lessonByModel).toEqual([]);
    expect(empty.wordSelection).toEqual({ all: { known: 0, tooEasy: 0 }, recent: { known: 0, tooEasy: 0 } });

    expect(buildQualityStats([count("rejected_known", 1)]).hasData).toBe(true);
  });
});
