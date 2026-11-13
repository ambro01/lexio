import type { APIRoute } from "astro";
import { sessionRequestSchema } from "@/lib/review/requests";
import { FlashcardStoreError } from "@/lib/services/flashcards.service";
import { loadReviewQueue } from "@/lib/services/review.service";
import { createClient } from "@/lib/supabase";

// A tag id and a limit; anything larger is not a session request.
const MAX_BODY_BYTES = 4 * 1024;

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function log(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log words, translations or ids.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "review_session", ...fields }));
}

/**
 * The cards of a review session of the signed-in user: without `tagId` the due and new cards (mastered ones
 * skipped); with it, every card of that tag. An unknown or another user's tag gives an empty list.
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby powtarzać fiszki." });
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

  const parsed = sessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, { error: "not_configured", message: "Powtórki nie są skonfigurowane." });
  }

  const mode = parsed.data.tagId === undefined ? "general" : "tag";
  const limit = parsed.data.limit;
  try {
    const cards = await loadReviewQueue(client, parsed.data);
    log({ status: 200, mode, limit, count: cards.length });
    return json(200, { cards });
  } catch (error) {
    if (error instanceof FlashcardStoreError) {
      log({ status: 500, mode, limit, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się wczytać powtórki. Spróbuj ponownie." });
    }
    throw error;
  }
};
