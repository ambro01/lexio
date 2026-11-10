// Shared entity and input types for flashcards (service, API routes and UI).
// Type-only imports keep this module loadable by plain Node scripts.
import type { CefrLevel } from "@/lib/ai/proposals";

export type { CefrLevel };

export interface Tag {
  id: string;
  name: string;
}

export interface Flashcard {
  id: string;
  word: string;
  translation: string;
  additionalMeanings: string[];
  exampleSentence: string;
  cefr: CefrLevel | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

/** Input for "save the word, or add the tags if the word already exists" (FR-005). */
export interface SaveFlashcardInput {
  word: string;
  translation: string;
  additionalMeanings: string[];
  exampleSentence: string;
  cefr: CefrLevel | null;
  tagNames: string[];
}

/** Content fields that can be edited on an existing card; tags are not edited here. */
export type UpdateFlashcardInput = Partial<
  Pick<Flashcard, "word" | "translation" | "additionalMeanings" | "exampleSentence" | "cefr">
>;
