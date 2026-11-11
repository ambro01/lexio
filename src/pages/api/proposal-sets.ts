import type { APIRoute } from "astro";
import { acceptRequestSchema, toAcceptSetItems } from "@/lib/ai/outcomes";
import { FlashcardStoreError, acceptProposalSet } from "@/lib/services/flashcards.service";
import { createClient } from "@/lib/supabase";

// 150 items with full content fit well below this; it keeps parsing cheap on the 10 ms CPU budget.
const MAX_BODY_BYTES = 400 * 1024;

const BAD_REQUEST = { error: "bad_request", message: "Nieprawidłowe żądanie." };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logAccept(fields: Record<string, unknown>): void {
  // One structured line per call for Workers logs; never log words or translations.
  // eslint-disable-next-line no-console -- intentional observability log
  console.log(JSON.stringify({ event: "proposal_set_accepted", ...fields }));
}

/**
 * Saves a reviewed proposal set: accepted cards with the lesson tag plus one outcome record per proposal.
 * A manual save (`source: "manual"`) is one card with an optional tag.
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return json(401, { error: "unauthorized", message: "Zaloguj się, aby zapisać fiszki." });
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

  const parsed = acceptRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, BAD_REQUEST);
  }

  const client = createClient(request.headers, cookies);
  if (!client) {
    return json(503, { error: "not_configured", message: "Zapisywanie fiszek nie jest skonfigurowane." });
  }

  const { tagName, model, source } = parsed.data;
  const items = toAcceptSetItems(parsed.data);
  const corrected = items.filter((item) => item.outcome === "accepted_corrected").length;
  try {
    const result = await acceptProposalSet(client, { tagName, model, items, source });
    logAccept({ status: 200, source, items: items.length, ...result, corrected });
    return json(200, result);
  } catch (error) {
    if (error instanceof FlashcardStoreError) {
      logAccept({ status: 500, source, items: items.length, corrected, reason: error.message });
      return json(500, { error: "store_failed", message: "Nie udało się zapisać zestawu. Spróbuj ponownie." });
    }
    throw error;
  }
};
