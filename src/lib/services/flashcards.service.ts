import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/ai/proposals";
import type {
  AcceptProposalSetInput,
  AcceptSetResult,
  Flashcard,
  FlashcardPage,
  SaveFlashcardInput,
  Tag,
  UpdateFlashcardInput,
} from "@/types";

export type FlashcardsClient = SupabaseClient<Database>;

/** Thrown when an edit would give a card the same word as another card of the user. */
export class DuplicateWordError extends Error {
  override name = "DuplicateWordError";
}

/** Thrown when the card does not exist or belongs to another user (RLS hides it). */
export class FlashcardNotFoundError extends Error {
  override name = "FlashcardNotFoundError";
}

/** Thrown when adding a tag would give a card more than 20 tags. */
export class TagLimitError extends Error {
  override name = "TagLimitError";
}

/** Any other storage failure. The message never contains user content. */
export class FlashcardStoreError extends Error {
  override name = "FlashcardStoreError";
}

const UNIQUE_VIOLATION = "23505";
const NO_DATA_FOUND = "P0002";
const PROGRAM_LIMIT_EXCEEDED = "54000";
const TAG_SUGGESTION_LIMIT = 20;

/** Cards per collection page. */
export const COLLECTION_PAGE_SIZE = 50;
/** Most tags `listTags` returns (suggestions for the collection's tag input). */
export const TAG_LIST_LIMIT = 500;

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
export function toKey(value: string): string {
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

/**
 * Saves a reviewed set in one transaction: accepted items become cards (or gain the tag if the word
 * exists) and every item gets an outcome record marked with its source. All or nothing. A manual save
 * has exactly one item and may have no tag.
 */
export async function acceptProposalSet(
  client: FlashcardsClient,
  input: AcceptProposalSetInput,
): Promise<AcceptSetResult> {
  const { data, error } = await client.rpc("accept_proposal_set", {
    // The SQL parameter accepts null (a manual save without a tag); the generated type marks it non-null.
    // A `!` would claim the value is never null, which is the opposite of the intent.
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- null is passed through
    p_tag_name: input.tagName as string,
    p_model: input.model,
    p_items: input.items,
    p_source: input.source,
  });
  if (error) {
    throw storeError("set accept", error);
  }
  const row = data.at(0);
  if (!row) {
    throw new FlashcardStoreError("Flashcard set accept returned no row");
  }
  return { created: row.created_count, merged: row.merged_count, rejected: row.rejected_count };
}

/** The word keys (see `toKey`) of the given words that are already in the user's collection. */
export async function findExistingWordKeys(client: FlashcardsClient, words: string[]): Promise<Set<string>> {
  const keys = [...new Set(words.map(toKey))].filter((key) => key !== "");
  if (keys.length === 0) {
    return new Set();
  }
  const { data, error } = await client.from("flashcards").select("word_key").in("word_key", keys);
  if (error) {
    throw storeError("word lookup", error);
  }
  // word_key is a generated column, so the generated types mark it nullable; it is never null in practice.
  return new Set(data.map((row) => row.word_key).filter((key): key is string => key !== null));
}

/**
 * One page of the user's cards with their tags, newest first; cards saved together (same `created_at`) are
 * ordered by `word_key`, which is unique per user, so the order is total and offset paging is stable.
 * One extra row is fetched to tell whether another page follows.
 */
export async function listFlashcards(
  client: FlashcardsClient,
  { offset, limit }: { offset: number; limit: number },
): Promise<FlashcardPage> {
  const { data, error } = await client
    .from("flashcards")
    .select(FLASHCARD_SELECT)
    .order("created_at", { ascending: false })
    .order("word_key", { ascending: true })
    .range(offset, offset + limit)
    .overrideTypes<FlashcardRow[], { merge: false }>();
  if (error) {
    throw storeError("list", error);
  }
  return { cards: data.slice(0, limit).map(toFlashcard), hasMore: data.length > limit };
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

/**
 * Links a tag to an existing card, creating the tag if the user has none with that name (one transaction).
 * `linked` is false when the card already had the tag.
 */
export async function addFlashcardTag(
  client: FlashcardsClient,
  flashcardId: string,
  tagName: string,
): Promise<{ tag: Tag; linked: boolean }> {
  const { data, error } = await client.rpc("add_flashcard_tag", {
    p_flashcard_id: flashcardId,
    p_tag_name: tagName,
  });
  if (error) {
    if (error.code === NO_DATA_FOUND) {
      throw new FlashcardNotFoundError("Flashcard not found");
    }
    if (error.code === PROGRAM_LIMIT_EXCEEDED) {
      throw new TagLimitError("Flashcard already has the maximum number of tags");
    }
    throw storeError("tag add", error);
  }
  const row = data.at(0);
  if (!row) {
    throw new FlashcardStoreError("Flashcard tag add returned no row");
  }
  return { tag: { id: row.tag_id, name: row.tag_name }, linked: row.linked };
}

/** Removes a tag from a card; the tag itself stays. Removing a link that is already gone is not an error. */
export async function removeFlashcardTag(client: FlashcardsClient, flashcardId: string, tagId: string): Promise<void> {
  const { error } = await client.from("flashcard_tags").delete().eq("flashcard_id", flashcardId).eq("tag_id", tagId);
  if (error) {
    throw storeError("tag remove", error);
  }
}

/** All of the user's tags ordered by name, at most `TAG_LIST_LIMIT`. */
export async function listTags(client: FlashcardsClient): Promise<Tag[]> {
  const { data, error } = await client.from("tags").select("id, name").order("name").limit(TAG_LIST_LIMIT);
  if (error) {
    throw storeError("tag list", error);
  }
  return data;
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
