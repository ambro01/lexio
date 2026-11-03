export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** One flashcard proposal returned by the model. */
export interface Proposal {
  /** English word in base form; phrasal verbs allowed. */
  word: string;
  /** Polish translation in the meaning used in the lesson text. */
  translation: string;
  /** Other common Polish meanings. */
  additionalMeanings: string[];
  /** Short English example sentence. */
  exampleSentence: string;
  cefr: CefrLevel;
}

export const MAX_INPUT_WORDS = 2000;
/** Guards against huge input without spaces, which the word count alone would not catch. */
export const MAX_INPUT_CHARS = 30000;

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Counts whitespace-separated tokens that contain at least one letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => WORD_CHAR.test(token)).length;
}

export type InputValidation =
  { ok: true; text: string; words: number } | { ok: false; code: "empty" | "too_long"; words: number };

export function validateInput(text: unknown): InputValidation {
  const trimmed = typeof text === "string" ? text.trim() : "";
  const words = countWords(trimmed);
  if (words === 0) {
    return { ok: false, code: "empty", words };
  }
  if (words > MAX_INPUT_WORDS || trimmed.length > MAX_INPUT_CHARS) {
    return { ok: false, code: "too_long", words };
  }
  return { ok: true, text: trimmed, words };
}

/** JSON schema sent to the model as the structured-output contract. Strict mode requires an object root. */
export const PROPOSALS_JSON_SCHEMA = {
  type: "object",
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string", description: "English word or phrasal verb in base form" },
          translation: { type: "string", description: "Polish translation in the meaning used in the text" },
          additionalMeanings: {
            type: "array",
            items: { type: "string" },
            description: "Other common Polish meanings",
          },
          exampleSentence: { type: "string", description: "Short English example sentence" },
          cefr: { type: "string", enum: CEFR_LEVELS, description: "Estimated CEFR level of the word" },
        },
        required: ["word", "translation", "additionalMeanings", "exampleSentence", "cefr"],
        additionalProperties: false,
      },
    },
  },
  required: ["proposals"],
  additionalProperties: false,
} as const;

/** The model's JSON does not have the `{ proposals: array }` root. */
export class InvalidModelOutputError extends Error {
  override name = "InvalidModelOutputError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isCefrLevel(value: string): value is CefrLevel {
  return (CEFR_LEVELS as readonly string[]).includes(value);
}

function toProposal(item: unknown): Proposal | null {
  if (!isRecord(item) || !Array.isArray(item.additionalMeanings)) {
    return null;
  }
  const word = nonEmptyString(item.word);
  const translation = nonEmptyString(item.translation);
  const exampleSentence = nonEmptyString(item.exampleSentence);
  const cefr = nonEmptyString(item.cefr)?.toUpperCase();
  if (!word || !translation || !exampleSentence || !cefr || !isCefrLevel(cefr)) {
    return null;
  }
  const meanings: unknown[] = item.additionalMeanings;
  const additionalMeanings = meanings.map(nonEmptyString).filter((meaning): meaning is string => meaning !== null);
  return { word, translation, additionalMeanings, exampleSentence, cefr };
}

/**
 * Validates the model's parsed JSON. Malformed items and repeated words are dropped and counted;
 * only a root that is not `{ proposals: array }` fails the whole generation.
 */
export function parseProposals(raw: unknown): { proposals: Proposal[]; dropped: number } {
  if (!isRecord(raw) || !Array.isArray(raw.proposals)) {
    throw new InvalidModelOutputError("Model output is not an object with a proposals array");
  }
  const items: unknown[] = raw.proposals;
  const seen = new Set<string>();
  const proposals: Proposal[] = [];
  for (const item of items) {
    const proposal = toProposal(item);
    if (!proposal) {
      continue;
    }
    const key = proposal.word.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    proposals.push(proposal);
  }
  return { proposals, dropped: items.length - proposals.length };
}
