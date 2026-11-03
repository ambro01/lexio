import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY } from "astro:env/server";
import { z } from "zod";
import { DEFAULT_AI_MODEL_ID, isAiModelId } from "@/lib/ai/models";
import { InvalidModelOutputError, MAX_INPUT_WORDS, validateInput } from "@/lib/ai/proposals";
import { UpstreamError, UpstreamTimeoutError, generateProposals } from "@/lib/services/ai-generation.service";

const requestSchema = z.object({
  text: z.string(),
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

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby generować fiszki." });
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

  const model = parsed.data.model ?? DEFAULT_AI_MODEL_ID;
  if (!isAiModelId(model)) {
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

  const started = Date.now();
  try {
    const result = await generateProposals({ text: input.text, model, apiKey: OPENROUTER_API_KEY });
    logGeneration({
      status: 200,
      model: result.model,
      durationMs: result.durationMs,
      inputWords: input.words,
      proposalCount: result.proposals.length,
      droppedCount: result.dropped,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    });
    return json(200, {
      proposals: result.proposals,
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
      logGeneration({ status: 504, model, durationMs, inputWords: input.words });
      return json(504, { error: "timeout", message: "Generowanie trwało zbyt długo. Spróbuj ponownie." });
    }
    if (error instanceof UpstreamError || error instanceof InvalidModelOutputError) {
      logGeneration({ status: 502, model, durationMs, inputWords: input.words, reason: error.message });
      return json(502, { error: "upstream", message: "Model AI nie odpowiedział poprawnie. Spróbuj ponownie." });
    }
    throw error;
  }
};
