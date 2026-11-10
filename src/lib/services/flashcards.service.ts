import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/ai/proposals";
import type { Flashcard, SaveFlashcardInput, Tag, UpdateFlashcardInput } from "@/types";

export type FlashcardsClient = SupabaseClient<Database>;

/** Thrown when an edit would give a card the same word as another card of the user. */
export class DuplicateWordError extends Error {
  override name = "DuplicateWordError";
}

/** Thrown when the card does not exist or belongs to another user (RLS hides it). */
export class FlashcardNotFoundError extends Error {
  override name = "FlashcardNotFoundError";
}

/** Any other storage failure. The message never contains user content. */
export class FlashcardStoreError extends Error {
  override name = "FlashcardStoreError";
}

const UNIQUE_VIOLATION = "23505";
const TAG_SUGGESTION_LIMIT = 20;

// Tags are reached through the link table: the composite foreign keys mean PostgREST
// cannot embed `tags` directly from `flashcards`.
const FLASHCARD_SELECT =
  "id, word, translation, additional_meanings, example_sentence, cefr, created_at, updated_at, flashcard_tags(tag:tags(id, name))";

interface FlashcardRow {
  id: string;
  word: string;
  translation: string;
  additional_meanings: string[];
  example_sentence: string;
  cefr: string | null;
  created_at: string;
  updated_at: string;
  flashcard_tags: { tag: Tag | null }[];
}

interface PostgrestErrorLike {
  code?: string;
}

function storeError(operation: string, error: PostgrestErrorLike): FlashcardStoreError {
  return new FlashcardStoreError(`Flashcard ${operation} failed${error.code ? ` (${error.code})` : ""}`);
}

function toCefr(value: string | null): CefrLevel | null {
  return CEFR_LEVELS.find((level) => level === value) ?? null;
}

function toFlashcard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    word: row.word,
    translation: row.translation,
    additionalMeanings: row.additional_meanings,
    exampleSentence: row.example_sentence,
    cefr: toCefr(row.cefr),
    tags: row.flashcard_tags
      .map((link) => link.tag)
      .filter((tag): tag is Tag => tag !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Same folding as the database's word_key / name_key: lowercase, trimmed, inner whitespace collapsed. */
function toKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Saves a new card, or adds the tags to the existing card with the same word (its content stays unchanged). */
export async function saveFlashcard(
  client: FlashcardsClient,
  input: SaveFlashcardInput,
): Promise<{ id: string; created: boolean }> {
  const { data, error } = await client.rpc("save_flashcard", {
    p_word: input.word,
    p_translation: input.translation,
    p_additional_meanings: input.additionalMeanings,
    p_example_sentence: input.exampleSentence,
    // The SQL parameter accepts null; the generated type marks every function argument as non-null.
    p_cefr: input.cefr as string,
    p_tag_names: input.tagNames,
  });
  if (error) {
    throw storeError("save", error);
  }
  const row = data.at(0);
  if (!row) {
    throw new FlashcardStoreError("Flashcard save returned no row");
  }
  return { id: row.flashcard_id, created: row.created };
}

/** All of the user's cards with their tags, newest first. */
export async function listFlashcards(client: FlashcardsClient): Promise<Flashcard[]> {
  const { data, error } = await client
    .from("flashcards")
    .select(FLASHCARD_SELECT)
    .order("created_at", { ascending: false })
    .overrideTypes<FlashcardRow[], { merge: false }>();
  if (error) {
    throw storeError("list", error);
  }
  return data.map(toFlashcard);
}

/** Edits a card's content; learning progress and tags are untouched. */
export async function updateFlashcard(
  client: FlashcardsClient,
  id: string,
  patch: UpdateFlashcardInput,
): Promise<Flashcard> {
  const changes: Database["public"]["Tables"]["flashcards"]["Update"] = {};
  if (patch.word !== undefined) changes.word = patch.word;
  if (patch.translation !== undefined) changes.translation = patch.translation;
  if (patch.additionalMeanings !== undefined) changes.additional_meanings = patch.additionalMeanings;
  if (patch.exampleSentence !== undefined) changes.example_sentence = patch.exampleSentence;
  if (patch.cefr !== undefined) changes.cefr = patch.cefr;

  const query =
    Object.keys(changes).length === 0
      ? client.from("flashcards").select(FLASHCARD_SELECT).eq("id", id)
      : client.from("flashcards").update(changes).eq("id", id).select(FLASHCARD_SELECT);
  const { data, error } = await query.maybeSingle().overrideTypes<FlashcardRow | null, { merge: false }>();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new DuplicateWordError("Another flashcard already has this word");
    }
    throw storeError("update", error);
  }
  if (!data) {
    throw new FlashcardNotFoundError("Flashcard not found");
  }
  return toFlashcard(data);
}

/** Deletes a card and its tag links; the tags themselves stay. */
export async function deleteFlashcard(client: FlashcardsClient, id: string): Promise<void> {
  const { data, error } = await client.from("flashcards").delete().eq("id", id).select("id");
  if (error) {
    throw storeError("delete", error);
  }
  if (data.length === 0) {
    throw new FlashcardNotFoundError("Flashcard not found");
  }
}

/** The user's tags ordered by name, optionally filtered by a case-insensitive prefix. */
export async function suggestTags(client: FlashcardsClient, prefix?: string): Promise<Tag[]> {
  let query = client.from("tags").select("id, name");
  // PostgREST also treats "*" as a LIKE wildcard, so it is dropped from the prefix.
  const key = prefix === undefined ? "" : toKey(prefix.replaceAll("*", ""));
  if (key) {
    query = query.like("name_key", `${escapeLike(key)}%`);
  }
  const { data, error } = await query.order("name").limit(TAG_SUGGESTION_LIMIT);
  if (error) {
    throw storeError("tag suggestion", error);
  }
  return data;
}
