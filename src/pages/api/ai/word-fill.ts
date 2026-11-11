import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY } from "astro:env/server";
import { MAX_TEXT_CHARS, MAX_WORD_CHARS } from "@/lib/ai/limits";
import { InvalidModelOutputError } from "@/lib/ai/proposals";
import { MAX_FILL_WORDS, wordFillInputSchema } from "@/lib/ai/word-fill";
import { UpstreamError, UpstreamTimeoutError, fillWord } from "@/lib/services/ai-generation.service";
import { findExistingWordKeys, toKey } from "@/lib/services/flashcards.service";
import { resolveProfileModel, type Lookup } from "@/lib/services/model-resolution";
import { createClient } from "@/lib/supabase";
import type { ReviewProposal } from "@/types";

// A word (≤ 100 chars) and a context (≤ 500 chars) fit easily, even as 4-byte UTF-8 with JSON escaping.
const MAX_BODY_BYTES = 4096;

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logFill(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log the word or the context.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "word_fill", ...fields }));
}

/** Whether the user already has the word. Never throws: `lookup` reports a failure, and the word counts as new. */
async function lookupWord(
  client: NonNullable<ReturnType<typeof createClient>>,
  word: string,
): Promise<{ inCollection: boolean; lookup: Lookup }> {
  try {
    const existing = await findExistingWordKeys(client, [word]);
    return { inCollection: existing.has(toKey(word)), lookup: "ok" };
  } catch {
    return { inCollection: false, lookup: "failed" };
  }
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby dodawać słowa." });
  }

  // Explicit JSON-only contract: cross-site form/text posts never reach the parser.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(415, BAD_REQUEST);
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json(400, BAD_REQUEST);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, BAD_REQUEST);
  }

  const parsed = wordFillInputSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return field === "context"
      ? json(400, {
          error: "bad_request",
          message: `Kontekst jest za długi — limit to ${String(MAX_TEXT_CHARS)} znaków.`,
        })
      : json(400, {
          error: "bad_request",
          message: `Wpisz słowo lub wyrażenie (do ${String(MAX_FILL_WORDS)} słów i ${String(MAX_WORD_CHARS)} znaków).`,
        });
  }
  const input = parsed.data;

  const client = createClient(request.headers, cookies);
  if (!OPENROUTER_API_KEY || !client) {
    return json(503, { error: "not_configured", message: "Uzupełnianie AI nie jest skonfigurowane." });
  }

  // Before the paid call: a word the user already has is not filled. A failed lookup only lets the fill run.
  const typed = await lookupWord(client, input.word);
  if (typed.inCollection) {
    logFill({ status: 409, typedLookup: typed.lookup });
    return json(409, { error: "in_collection", message: "To słowo jest już w kolekcji." });
  }

  const { model, modelSource, profileLookup } = await resolveProfileModel(client);

  const started = Date.now();
  try {
    const result = await fillWord({ word: input.word, context: input.context, model, apiKey: OPENROUTER_API_KEY });
    // Normalisation can turn a new input into an existing word ("went" → "go"), so the filled word is checked too.
    const filled = await lookupWord(client, result.proposal.word);
    // Exact comparison after whitespace collapse: a case change ("Gave up" → "give up") counts as normalised.
    const normalised = result.proposal.word.replace(/\s+/g, " ") !== input.word;
    const proposal: ReviewProposal = { ...result.proposal, inCollection: filled.inCollection };
    logFill({
      status: 200,
      model: result.model,
      modelSource,
      profileLookup,
      durationMs: result.durationMs,
      normalised,
      inCollection: filled.inCollection,
      typedLookup: typed.lookup,
      inCollectionLookup: filled.lookup,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    });
    return json(200, {
      proposal,
      typedWord: input.word,
      meta: { model: result.model, durationMs: result.durationMs, usage: result.usage },
    });
  } catch (error) {
    const durationMs = Date.now() - started;
    if (error instanceof UpstreamTimeoutError) {
      logFill({ status: 504, model, modelSource, profileLookup, durationMs, typedLookup: typed.lookup });
      return json(504, { error: "timeout", message: "Generowanie trwało zbyt długo. Spróbuj ponownie." });
    }
    if (error instanceof UpstreamError || error instanceof InvalidModelOutputError) {
      logFill({
        status: 502,
        model,
        modelSource,
        profileLookup,
        durationMs,
        typedLookup: typed.lookup,
        reason: error.message,
      });
      return json(502, { error: "upstream", message: "Model AI nie odpowiedział poprawnie. Spróbuj ponownie." });
    }
    throw error;
  }
};
