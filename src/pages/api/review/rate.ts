import type { APIRoute } from "astro";
import { rateRequestSchema } from "@/lib/review/requests";
import { FlashcardNotFoundError, FlashcardStoreError } from "@/lib/services/flashcards.service";
import { ReviewConflictError, rateCard } from "@/lib/services/review.service";
import { createClient } from "@/lib/supabase";

// A card id and a rating; anything larger is not a rating request.
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
  console.log(JSON.stringify({ event: "review_rate", ...fields }));
}

/**
 * Rates one card of the signed-in user and stores its next FSRS state. Returns when the card is due next and its
 * FSRS state (0 new, 1 learning, 2 review, 3 relearning). 409 when another rating was stored in between.
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

  const parsed = rateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, { error: "not_configured", message: "Powtórki nie są skonfigurowane." });
  }

  const { flashcardId, rating } = parsed.data;
  try {
    const next = await rateCard(client, flashcardId, rating, new Date());
    log({ status: 200, rating });
    return json(200, { due: next.due.toISOString(), state: next.state });
  } catch (error) {
    if (error instanceof FlashcardNotFoundError) {
      log({ status: 404, rating });
      return json(404, { error: "not_found", message: "Ta fiszka już nie istnieje." });
    }
    if (error instanceof ReviewConflictError) {
      log({ status: 409, rating });
      return json(409, { error: "conflict", message: "Ta karta została już oceniona. Odśwież sesję." });
    }
    if (error instanceof FlashcardStoreError) {
      log({ status: 500, rating, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się zapisać oceny. Spróbuj ponownie." });
    }
    throw error;
  }
};
