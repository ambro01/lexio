// The AI content-quality metric (PRD Success Criteria, S-07): the single definition, pure (no astro:* or Supabase
// imports), so the stats service, the page and the tests share it.
// rate = (accepted_unchanged + accepted_corrected) ÷ (accepted_unchanged + accepted_corrected + rejected_wrong).
// "Znam / nieprzydatne" (rejected_known) and "Za łatwe" (rejected_too_easy) judge the word selection, not the
// content, so they are left out of the rate and counted separately. Merged accepts arrive as accepted_* and count.
import type { ProposalOutcome, ProposalSource } from "@/types";

/** The PRD target for the overall lesson rate. */
export const QUALITY_TARGET = 0.75;

/** Every recorded outcome value (`proposal_outcomes.outcome`). */
export const PROPOSAL_OUTCOMES = [
  "accepted_unchanged",
  "accepted_corrected",
  "rejected_wrong",
  "rejected_known",
  "rejected_too_easy",
] as const satisfies readonly ProposalOutcome[];

/** One aggregated row of `proposal_outcome_stats`: how many outcomes share these values. */
export interface OutcomeCount {
  source: ProposalSource;
  model: string | null;
  outcome: ProposalOutcome;
  /** Recorded within the last 30 days. */
  recent: boolean;
  n: number;
}

export interface QualityRate {
  /** (unchanged + corrected) ÷ rated; `null` when nothing was rated. */
  rate: number | null;
  /** unchanged + corrected + wrong. */
  rated: number;
  /** unchanged ÷ (unchanged + corrected); `null` when nothing was accepted. */
  unchangedShare: number | null;
  /** unchanged + corrected. */
  accepted: number;
}

export interface PeriodRates {
  /** Every outcome. */
  all: QualityRate;
  /** Outcomes from the last 30 days. */
  recent: QualityRate;
}

export interface WordSelectionCounts {
  known: number;
  tooEasy: number;
}

export interface QualityStats {
  /** Lesson outcomes, every model. */
  lesson: PeriodRates;
  /** Lesson outcomes per model (`null`: recorded without a model), most rated first, then by model name. */
  lessonByModel: (PeriodRates & { model: string | null })[];
  /** Words added on `/add` with AI fill. */
  manual: PeriodRates;
  /** Lesson word-selection rejections, counted apart from the rate. */
  wordSelection: { all: WordSelectionCounts; recent: WordSelectionCounts };
  /** Any outcome recorded at all. */
  hasData: boolean;
}

function sumOf(counts: readonly OutcomeCount[], outcome: ProposalOutcome): number {
  return counts.reduce((total, count) => (count.outcome === outcome ? total + count.n : total), 0);
}

/** The quality figures of a set of counts; known and too-easy outcomes are ignored. */
export function qualityRate(counts: readonly OutcomeCount[]): QualityRate {
  const unchanged = sumOf(counts, "accepted_unchanged");
  const corrected = sumOf(counts, "accepted_corrected");
  const wrong = sumOf(counts, "rejected_wrong");
  const accepted = unchanged + corrected;
  const rated = accepted + wrong;
  return {
    rate: rated === 0 ? null : accepted / rated,
    rated,
    unchangedShare: accepted === 0 ? null : unchanged / accepted,
    accepted,
  };
}

function periodRates(counts: readonly OutcomeCount[]): PeriodRates {
  return { all: qualityRate(counts), recent: qualityRate(counts.filter((count) => count.recent)) };
}

function wordSelection(counts: readonly OutcomeCount[]): WordSelectionCounts {
  return { known: sumOf(counts, "rejected_known"), tooEasy: sumOf(counts, "rejected_too_easy") };
}

// Named models by name; the unknown model after them.
function compareModels(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

/** Every figure the stats page shows. "all" figures sum recent and older rows; "recent" uses `recent = true` only. */
export function buildQualityStats(counts: readonly OutcomeCount[]): QualityStats {
  const lesson = counts.filter((count) => count.source === "lesson");
  const manual = counts.filter((count) => count.source === "manual");

  const byModel = Map.groupBy(lesson, (count) => count.model);
  const lessonByModel = [...byModel]
    .map(([model, modelCounts]) => ({ model, ...periodRates(modelCounts) }))
    .sort((a, b) => b.all.rated - a.all.rated || compareModels(a.model, b.model));

  return {
    lesson: periodRates(lesson),
    lessonByModel,
    manual: periodRates(manual),
    wordSelection: {
      all: wordSelection(lesson),
      recent: wordSelection(lesson.filter((count) => count.recent)),
    },
    hasData: counts.some((count) => count.n > 0),
  };
}
