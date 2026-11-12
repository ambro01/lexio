import type { APIRoute } from "astro";
import { editRequestSchema, isUuid } from "@/lib/collection";
import {
  DuplicateWordError,
  FlashcardNotFoundError,
  FlashcardStoreError,
  deleteFlashcard,
  updateFlashcard,
} from "@/lib/services/flashcards.service";
import { createClient } from "@/lib/supabase";

// One card with full content fits well below this, even as 4-byte UTF-8 with JSON escaping.
const MAX_BODY_BYTES = 8 * 1024;

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };
const NOT_FOUND = { error: "not_found", message: "Ta fiszka już nie istnieje." };
const NOT_CONFIGURED = { error: "not_configured", message: "Kolekcja nie jest skonfigurowana." };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function log(event: "flashcard_updated" | "flashcard_deleted", fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log words, translations or ids.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event, ...fields }));
}

/** Edits one card of the signed-in user: the whole content and the CEFR level. Tags and progress stay. */
export const PATCH: APIRoute = async ({ request, params, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby edytować fiszki." });
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

  const parsed = editRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, NOT_CONFIGURED);
  }

  try {
    const card = await updateFlashcard(client, id, parsed.data);
    log("flashcard_updated", { status: 200 });
    return json(200, card);
  } catch (error) {
    if (error instanceof DuplicateWordError) {
      log("flashcard_updated", { status: 409 });
      return json(409, { error: "duplicate_word", message: "Takie słowo jest już w kolekcji." });
    }
    if (error instanceof FlashcardNotFoundError) {
      log("flashcard_updated", { status: 404 });
      return json(404, NOT_FOUND);
    }
    if (error instanceof FlashcardStoreError) {
      log("flashcard_updated", { status: 500, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się zapisać fiszki. Spróbuj ponownie." });
    }
    throw error;
  }
};

/** Deletes one card of the signed-in user and its tag links; the tags and AI outcome records stay. */
export const DELETE: APIRoute = async ({ request, params, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby usuwać fiszki." });
  }

  // Checked before any query: a malformed id would otherwise be a Postgres 22P02 → 500.
  const id = params.id;
  if (!isUuid(id)) {
    return json(404, NOT_FOUND);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, NOT_CONFIGURED);
  }

  try {
    await deleteFlashcard(client, id);
    log("flashcard_deleted", { status: 204 });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof FlashcardNotFoundError) {
      log("flashcard_deleted", { status: 404 });
      return json(404, NOT_FOUND);
    }
    if (error instanceof FlashcardStoreError) {
      log("flashcard_deleted", { status: 500, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się usunąć fiszki. Spróbuj ponownie." });
    }
    throw error;
  }
};
