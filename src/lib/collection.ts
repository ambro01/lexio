// Request contracts of the collection API (S-05): edit a card, add a tag, page through the list — plus the pure
// list/tag helpers of the "Kolekcja" island.
// Pure (no astro:* imports), so the endpoints, the UI and the tests share one definition.
import { z } from "zod";
import { MAX_TAG_CHARS } from "@/lib/ai/limits";
import { contentSchema } from "@/lib/ai/outcomes";
import { CEFR_LEVELS } from "@/lib/ai/proposals";
import type { Flashcard, FlashcardPage, Tag } from "@/types";

/** Highest `offset` the list endpoint accepts (far beyond any real collection). */
export const MAX_PAGE_OFFSET = 100_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Body of `PATCH /api/flashcards/[id]`: the whole card (the form always sends every field), with the same
 * normalisation and limits as an accepted proposal. `cefr: null` means "no level".
 */
export const editRequestSchema = contentSchema.extend({ cefr: z.enum(CEFR_LEVELS).nullable() });

/** What the client sends. */
export type EditRequestBody = z.input<typeof editRequestSchema>;

/** Body of `POST /api/flashcards/[id]/tags`; the name comes out whitespace-normalised, 1–50 characters. */
export const addTagRequestSchema = z.object({
  name: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(MAX_TAG_CHARS)),
});

/** Query of `GET /api/flashcards`: `offset` is a non-negative integer, 0 when absent. */
export const pageQuerySchema = z.object({
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().max(MAX_PAGE_OFFSET)).default(0),
});

/** True for a canonical UUID; route ids are checked before any query so a malformed id is a 404, not a 500. */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

/**
 * Appends the next page to the loaded cards, dropping cards already shown. The list order (`created_at`, `id`)
 * cannot change through edits, so this is a safety net (e.g. a card added in another tab shifts the offset).
 */
export function appendPage(cards: Flashcard[], page: FlashcardPage): Flashcard[] {
  const shown = new Set(cards.map((card) => card.id));
  return [...cards, ...page.cards.filter((card) => !shown.has(card.id))];
}

function byName(a: Tag, b: Tag): number {
  return a.name.localeCompare(b.name);
}

/** The card with the tag added (or replaced, if it already has that id), tags sorted by name like the service. */
export function withTag(card: Flashcard, tag: Tag): Flashcard {
  return { ...card, tags: [...card.tags.filter((current) => current.id !== tag.id), tag].sort(byName) };
}

/** The card without the tag. */
export function withoutTag(card: Flashcard, tagId: string): Flashcard {
  return { ...card, tags: card.tags.filter((tag) => tag.id !== tagId) };
}

/** Same folding as the database's name_key: lowercase, trimmed, inner whitespace collapsed. */
function tagKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Adds a tag name to the suggestion list unless one with the same key is there; the list stays sorted. */
export function mergeTagName(names: string[], name: string): string[] {
  const key = tagKey(name);
  if (key === "" || names.some((current) => tagKey(current) === key)) {
    return names;
  }
  return [...names, name].sort((a, b) => a.localeCompare(b));
}
