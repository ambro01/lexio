import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY } from "astro:env/server";
import { MAX_PAGE_IMAGE_CHARS, pageImageSchema } from "@/lib/ai/page-text";
import { InvalidModelOutputError, countWords } from "@/lib/ai/proposals";
import { UpstreamError, UpstreamTimeoutError, transcribePage } from "@/lib/services/ai-generation.service";
import { resolveProfileModel } from "@/lib/services/model-resolution";
import { createClient } from "@/lib/supabase";

// The image cap plus room for the JSON wrapper; base64 is ASCII, so chars and bytes match.
const MAX_BODY_BYTES = MAX_PAGE_IMAGE_CHARS + 40_000;

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logPageText(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log the image or the transcribed text.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "page_text", ...fields }));
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby generować fiszki." });
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

  const parsed = pageImageSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }
  const { image } = parsed.data;

  const client = createClient(request.headers, cookies);
  if (!OPENROUTER_API_KEY || !client) {
    return json(503, { error: "not_configured", message: "Generowanie AI nie jest skonfigurowane." });
  }

  const { model, modelSource, profileLookup } = await resolveProfileModel(client);

  const started = Date.now();
  try {
    const result = await transcribePage({ image, model, apiKey: OPENROUTER_API_KEY });
    logPageText({
      status: 200,
      model: result.model,
      modelSource,
      profileLookup,
      durationMs: result.durationMs,
      imageChars: image.length,
      words: countWords(result.text),
      unreadable: result.unreadable,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    });
    return json(200, {
      text: result.text,
      unreadable: result.unreadable,
      meta: { model: result.model, durationMs: result.durationMs, usage: result.usage },
    });
  } catch (error) {
    const durationMs = Date.now() - started;
    if (error instanceof UpstreamTimeoutError) {
      logPageText({ status: 504, model, modelSource, profileLookup, durationMs, imageChars: image.length });
      return json(504, { error: "timeout", message: "Generowanie trwało zbyt długo. Spróbuj ponownie." });
    }
    if (error instanceof UpstreamError || error instanceof InvalidModelOutputError) {
      logPageText({
        status: 502,
        model,
        modelSource,
        profileLookup,
        durationMs,
        imageChars: image.length,
        reason: error.message,
      });
      return json(502, { error: "upstream", message: "Model AI nie odpowiedział poprawnie. Spróbuj ponownie." });
    }
    throw error;
  }
};
