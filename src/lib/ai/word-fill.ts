// Contract of the single-card AI fill (S-04, FR-006): prompt, structured-output schema, parser and input rules.
// Pure (no astro:* imports), so the service, the endpoint and the tests share one definition.
import { z } from "zod";
import { MAX_TEXT_CHARS, MAX_WORD_CHARS } from "@/lib/ai/limits";
import { CEFR_LEVELS, InvalidModelOutputError, toValidProposal, type Proposal } from "@/lib/ai/proposals";

/** A word or a phrasal verb, never a sentence. */
export const MAX_FILL_WORDS = 6;

export const WORD_FILL_SYSTEM_PROMPT = [
  "You help a Polish adult learner of English make one vocabulary flashcard.",
  "You get one English word or phrasal verb, and optionally a context sentence in which the learner met it.",
  "Return the word in its English base form, correcting obvious spelling mistakes.",
  "Translate it into Polish in the meaning the context sentence implies, or in its most common meaning when there is no context.",
  "List other common meanings of the word in Polish, or an empty list if there are none.",
  "Write one short English example sentence using the word in the translated meaning.",
  "Estimate the CEFR level (A1, A2, B1, B2, C1 or C2) of the word.",
  "Answer only with JSON matching the provided schema.",
].join(" ");

/** JSON schema sent to the model: the fields of one proposal, strict. */
export const WORD_FILL_JSON_SCHEMA = {
  type: "object",
  properties: {
    word: { type: "string", description: "English word or phrasal verb in base form, spelling corrected" },
    translation: { type: "string", description: "Polish translation in the meaning implied by the context" },
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
} as const;

/** Validates the model's fill with the same rules as one lesson proposal; anything invalid fails the fill. */
export function parseWordFill(raw: unknown): Proposal {
  const proposal = toValidProposal(raw);
  if (!proposal) {
    throw new InvalidModelOutputError("Model output is not a valid word fill");
  }
  return proposal;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Request body of the fill: the typed word (whitespace collapsed) and an optional context sentence. */
export const wordFillInputSchema = z.object({
  word: z
    .string()
    .transform(collapseWhitespace)
    .pipe(
      z
        .string()
        .min(1)
        .max(MAX_WORD_CHARS)
        .refine((word) => word.split(" ").length <= MAX_FILL_WORDS),
    ),
  context: z
    .string()
    .transform((context) => context.trim())
    .pipe(z.string().max(MAX_TEXT_CHARS))
    .optional()
    .transform((context) => (context === "" ? undefined : context)),
});

export type WordFillInput = z.infer<typeof wordFillInputSchema>;

/** The user message: `Word: <word>`, plus `Context: <context>` on a new line when given. */
export function wordFillUserMessage(input: { word: string; context?: string }): string {
  return input.context ? `Word: ${input.word}\nContext: ${input.context}` : `Word: ${input.word}`;
}
