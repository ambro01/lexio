import type { APIRoute } from "astro";
import { z } from "zod";
import { isAiModelId, type AiModelId } from "@/lib/ai/models";
import { CEFR_LEVELS } from "@/lib/ai/proposals";
import { ProfileStoreError, saveProfile } from "@/lib/services/profiles.service";
import { createClient } from "@/lib/supabase";

// The body is two short fields; anything larger is not a profile.
const MAX_BODY_BYTES = 1024;

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };

const profileSchema = z.object({
  cefrLevel: z.enum(CEFR_LEVELS).nullable(),
  // Only the models configured in src/lib/ai/models.ts.
  aiModel: z.custom<AiModelId>(isAiModelId).nullable(),
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logSave(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "profile_saved", ...fields }));
}

/** Saves the signed-in user's profile: CEFR level and AI model, each `null` for "not set". */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby zapisać profil." });
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

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, { error: "not_configured", message: "Zapisywanie profilu nie jest skonfigurowane." });
  }

  try {
    const profile = await saveProfile(client, parsed.data);
    logSave({ status: 200 });
    return json(200, profile);
  } catch (error) {
    if (error instanceof ProfileStoreError) {
      logSave({ status: 500, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się zapisać profilu. Spróbuj ponownie." });
    }
    throw error;
  }
};
