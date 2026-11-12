import type { APIRoute } from "astro";
import { isUuid } from "@/lib/collection";
import { FlashcardStoreError, removeFlashcardTag } from "@/lib/services/flashcards.service";
import { createClient } from "@/lib/supabase";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logRemove(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log tag names or ids.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "flashcard_tag_removed", ...fields }));
}

/** Removes a tag from one card of the signed-in user; the tag stays. A link that is already gone is a 204 too. */
export const DELETE: APIRoute = async ({ request, params, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby usuwać tagi." });
  }

  // Checked before any query: a malformed id would otherwise be a Postgres 22P02 → 500.
  const { id, tagId } = params;
  if (!isUuid(id) || !isUuid(tagId)) {
    return json(404, { error: "not_found", message: "Ta fiszka już nie istnieje." });
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, { error: "not_configured", message: "Kolekcja nie jest skonfigurowana." });
  }

  try {
    await removeFlashcardTag(client, id, tagId);
    logRemove({ status: 204 });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof FlashcardStoreError) {
      logRemove({ status: 500, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się usunąć tagu. Spróbuj ponownie." });
    }
    throw error;
  }
};
