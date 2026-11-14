import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { PROPOSAL_SOURCES } from "@/lib/ai/outcomes";
import { PROPOSAL_OUTCOMES, buildQualityStats, type OutcomeCount, type QualityStats } from "@/lib/ai/quality-stats";
import { FlashcardStoreError } from "@/lib/services/flashcards.service";

export type StatsClient = SupabaseClient<Database>;

interface PostgrestErrorLike {
  code?: string;
}

/** Maps an RPC error by SQLSTATE only; the message never contains user content. */
function storeError(operation: string, error: PostgrestErrorLike): FlashcardStoreError {
  return new FlashcardStoreError(`Stats ${operation} failed${error.code ? ` (${error.code})` : ""}`);
}

// model is null for outcomes recorded without a model, and PostgREST may send the bigint count as a string;
// the generated types mark model non-null and n a number.
interface OutcomeStatsRow {
  source: string;
  model: string | null;
  outcome: string;
  recent: boolean;
  n: number | string;
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

/** A typed count, or `null` for a source/outcome value this code does not know (skipped, not an error). */
function toOutcomeCount(row: OutcomeStatsRow): OutcomeCount | null {
  const { source, outcome } = row;
  const n = Number(row.n);
  if (!isOneOf(PROPOSAL_SOURCES, source) || !isOneOf(PROPOSAL_OUTCOMES, outcome) || !Number.isFinite(n)) {
    return null;
  }
  return { source, model: row.model, outcome, recent: row.recent, n };
}

/** The caller's AI content-quality figures (S-07), from `proposal_outcome_stats`; RLS limits it to own outcomes. */
export async function getQualityStats(client: StatsClient): Promise<QualityStats> {
  const { data, error } = await client
    .rpc("proposal_outcome_stats")
    .overrideTypes<OutcomeStatsRow[], { merge: false }>();
  if (error) {
    throw storeError("outcome stats", error);
  }
  const counts = data.map(toOutcomeCount).filter((count): count is OutcomeCount => count !== null);
  return buildQualityStats(counts);
}
