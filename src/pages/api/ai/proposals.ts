import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY } from "astro:env/server";
import { z } from "zod";
import { isAiModelId } from "@/lib/ai/models";
import {
  InvalidModelOutputError,
  MAX_INPUT_CHARS,
  MAX_INPUT_WORDS,
  validateInput,
  type Proposal,
} from "@/lib/ai/proposals";
import { UpstreamError, UpstreamTimeoutError, generateProposals } from "@/lib/services/ai-generation.service";
import { findExistingWordKeys, toKey } from "@/lib/services/flashcards.service";
import { resolveProfileModel, type Lookup } from "@/lib/services/model-resolution";
import { createClient } from "@/lib/supabase";
import type { ReviewProposal } from "@/types";

// Hard ceiling well above the 30,000-char input cap: keeps parsing and word counting cheap on the 10 ms CPU budget.
const MAX_TEXT_CHARS = MAX_INPUT_CHARS * 10;
const MAX_BODY_BYTES = MAX_TEXT_CHARS * 4;

const requestSchema = z.object({
  text: z.string().max(MAX_TEXT_CHARS),
  model: z.string().optional(),
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logGeneration(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log the lesson text.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "ai_generation", ...fields }));
}

/** Marks proposals whose word the user already has. Never throws: a paid generation must not fail here. */
async function markInCollection(
  proposals: Proposal[],
  client: ReturnType<typeof createClient>,
): Promise<{ proposals: ReviewProposal[]; lookup: Lookup }> {
  let existing = new Set<string>();
  let lookup: Lookup = "ok";
  if (!client) {
    lookup = "unavailable";
  } else {
    try {
      existing = await findExistingWordKeys(
        client,
        proposals.map((proposal) => proposal.word),
      );
    } catch {
      lookup = "failed";
    }
  }
  return {
    proposals: proposals.map((proposal) => ({ ...proposal, inCollection: existing.has(toKey(proposal.word)) })),
    lookup,
  };
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby generować fiszki." });
  }

  // Explicit JSON-only contract: cross-site form/text posts never reach the parser.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(415, { error: "bad_request", message: "Nieprawidłowe żądanie." });
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json(400, { error: "too_long", message: `Tekst jest za długi — limit to ${String(MAX_INPUT_WORDS)} słów.` });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "bad_request", message: "Nieprawidłowe żądanie." });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: "bad_request", message: "Nieprawidłowe żądanie." });
  }

  // An explicit model (e.g. the measurement script) wins and must be configured; otherwise the profile decides.
  const requestedModel = parsed.data.model;
  if (requestedModel !== undefined && !isAiModelId(requestedModel)) {
    return json(400, { error: "unknown_model", message: "Nieznany model AI." });
  }

  const input = validateInput(parsed.data.text);
  if (!input.ok) {
    return input.code === "empty"
      ? json(400, { error: "empty", message: "Wklej tekst lekcji." })
      : json(400, {
          error: "too_long",
          message: `Tekst ma ${String(input.words)} słów — limit to ${String(MAX_INPUT_WORDS)}.`,
        });
  }

  if (!OPENROUTER_API_KEY) {
    return json(503, { error: "not_configured", message: "Generowanie AI nie jest skonfigurowane." });
  }

  // One client for the profile read and the collection lookup.
  const client = createClient(request.headers, cookies);
  const { model, modelSource, profileLookup } = isAiModelId(requestedModel)
    ? { model: requestedModel, modelSource: "request" as const, profileLookup: undefined }
    : await resolveProfileModel(client);

  const started = Date.now();
  try {
    const result = await generateProposals({ text: input.text, model, apiKey: OPENROUTER_API_KEY });
    const marked = await markInCollection(result.proposals, client);
    logGeneration({
      status: 200,
      model: result.model,
      modelSource,
      profileLookup,
      durationMs: result.durationMs,
      inputWords: input.words,
      proposalCount: result.proposals.length,
      droppedCount: result.dropped,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      inCollectionCount: marked.proposals.filter((proposal) => proposal.inCollection).length,
      inCollectionLookup: marked.lookup,
    });
    return json(200, {
      proposals: marked.proposals,
      meta: {
        model: result.model,
        durationMs: result.durationMs,
        inputWords: input.words,
        dropped: result.dropped,
        usage: result.usage,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - started;
    if (error instanceof UpstreamTimeoutError) {
      logGeneration({ status: 504, model, modelSource, profileLookup, durationMs, inputWords: input.words });
      return json(504, { error: "timeout", message: "Generowanie trwało zbyt długo. Spróbuj ponownie." });
    }
    if (error instanceof UpstreamError || error instanceof InvalidModelOutputError) {
      logGeneration({
        status: 502,
        model,
        modelSource,
        profileLookup,
        durationMs,
        inputWords: input.words,
        reason: error.message,
      });
      return json(502, { error: "upstream", message: "Model AI nie odpowiedział poprawnie. Spróbuj ponownie." });
    }
    throw error;
  }
};
