import type { APIRoute } from "astro";
import { isUuid } from "@/lib/collection";
import { masteredRequestSchema } from "@/lib/review/requests";
import { FlashcardNotFoundError, FlashcardStoreError } from "@/lib/services/flashcards.service";
import { setMastered } from "@/lib/services/review.service";
import { createClient } from "@/lib/supabase";

// `{"mastered":true}`; anything larger is not a mastered request.
const MAX_BODY_BYTES = 4 * 1024;

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };
const NOT_FOUND = { error: "not_found", message: "Ta fiszka już nie istnieje." };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function log(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log words, translations or ids.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "review_mastered", ...fields }));
}

/**
 * Marks one card of the signed-in user as mastered ("Opanowane") or not. A mastered card leaves the general
 * review session; its learning progress is kept.
 */
export const PUT: APIRoute = async ({ request, params, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby oznaczać fiszki." });
  }

  // Checked before any query: a malformed id would otherwise be a Postgres 22P02 → 500.
  const id = params.id;
  if (!isUuid(id)) {
    return json(404, NOT_FOUND);
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

  const parsed = masteredRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, { error: "not_configured", message: "Kolekcja nie jest skonfigurowana." });
  }

  const { mastered } = parsed.data;
  try {
    await setMastered(client, id, mastered, new Date());
    log({ status: 200, mastered });
    return json(200, { mastered });
  } catch (error) {
    if (error instanceof FlashcardNotFoundError) {
      log({ status: 404, mastered });
      return json(404, NOT_FOUND);
    }
    if (error instanceof FlashcardStoreError) {
      log({ status: 500, mastered, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się zapisać zmiany. Spróbuj ponownie." });
    }
    throw error;
  }
};
