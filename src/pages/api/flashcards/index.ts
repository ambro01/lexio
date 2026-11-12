import type { APIRoute } from "astro";
import { pageQuerySchema } from "@/lib/collection";
import { COLLECTION_PAGE_SIZE, FlashcardStoreError, listFlashcards } from "@/lib/services/flashcards.service";
import { createClient } from "@/lib/supabase";

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logList(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log words or translations.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "collection_listed", ...fields }));
}

/** The next page of the signed-in user's collection ("Pokaż więcej"): `?offset=<cards already loaded>`. */
export const GET: APIRoute = async ({ request, url, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby zobaczyć kolekcję." });
  }

  const parsed = pageQuerySchema.safeParse({ offset: url.searchParams.get("offset") ?? undefined });
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, { error: "not_configured", message: "Kolekcja nie jest skonfigurowana." });
  }

  try {
    const page = await listFlashcards(client, { offset: parsed.data.offset, limit: COLLECTION_PAGE_SIZE });
    logList({ status: 200, count: page.cards.length });
    return json(200, page);
  } catch (error) {
    if (error instanceof FlashcardStoreError) {
      logList({ status: 500, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się wczytać kolekcji. Spróbuj ponownie." });
    }
    throw error;
  }
};
