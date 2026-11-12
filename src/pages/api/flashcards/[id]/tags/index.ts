import type { APIRoute } from "astro";
import { addTagRequestSchema, isUuid } from "@/lib/collection";
import {
  FlashcardNotFoundError,
  FlashcardStoreError,
  TagLimitError,
  addFlashcardTag,
} from "@/lib/services/flashcards.service";
import { createClient } from "@/lib/supabase";

// A tag name is at most 50 characters; anything larger is not a tag request.
const MAX_BODY_BYTES = 1024;

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };
const NOT_FOUND = { error: "not_found", message: "Ta fiszka już nie istnieje." };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logAdd(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log tag names or ids.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "flashcard_tag_added", ...fields }));
}

/** Adds a tag to one card of the signed-in user, creating the tag if new. `linked` is false if the card had it. */
export const POST: APIRoute = async ({ request, params, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby dodawać tagi." });
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

  const parsed = addTagRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, { error: "not_configured", message: "Kolekcja nie jest skonfigurowana." });
  }

  try {
    const result = await addFlashcardTag(client, id, parsed.data.name);
    logAdd({ status: 200, linked: result.linked });
    return json(200, result);
  } catch (error) {
    if (error instanceof FlashcardNotFoundError) {
      logAdd({ status: 404 });
      return json(404, NOT_FOUND);
    }
    if (error instanceof TagLimitError) {
      logAdd({ status: 409 });
      return json(409, { error: "tag_limit", message: "Fiszka może mieć najwyżej 20 tagów." });
    }
    if (error instanceof FlashcardStoreError) {
      logAdd({ status: 500, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się dodać tagu. Spróbuj ponownie." });
    }
    throw error;
  }
};
