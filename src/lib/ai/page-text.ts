// Contract of the page transcription (S-10, FR-017): prompt, structured-output schema, parser and input rules.
// Pure (no astro:* imports), so the service, the endpoint and the tests share one definition.
import { z } from "zod";
import { InvalidModelOutputError } from "@/lib/ai/proposals";
import { isRecord } from "@/lib/utils";

/** About 450 KB of JPEG as base64, roughly 3× the measured size of one rendered page. */
export const MAX_PAGE_IMAGE_CHARS = 600_000;

export const PAGE_IMAGE_PREFIX = "data:image/jpeg;base64,";

export const PAGE_TEXT_SYSTEM_PROMPT = [
  "You transcribe one page of an English lesson worksheet for a Polish adult learner of English.",
  "Transcribe the English lesson text of the page: headings, instructions, exercise sentences, vocabulary, grammar notes, and notes the teacher added by hand or typed.",
  "Skip photos, illustrations, QR codes, logos, page headers and footers, publisher, branding and licence lines, and page numbers.",
  "Keep the original wording: do not correct, complete or translate anything.",
  "Set unreadable to true when the page has lesson text that cannot be read (blurred, skewed or very low contrast), or when it has no lesson text at all.",
  "Answer only with JSON matching the provided schema.",
].join(" ");

/** JSON schema sent to the model: the page text and the unreadable flag, strict. */
export const PAGE_TEXT_JSON_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", description: "English lesson text of the page, wording kept" },
    unreadable: {
      type: "boolean",
      description: "True when lesson text on the page cannot be read, or the page has no lesson text",
    },
  },
  required: ["text", "unreadable"],
  additionalProperties: false,
} as const;

export interface PageText {
  text: string;
  unreadable: boolean;
}

/** Validates the model's transcription; the text is trimmed and an empty text counts as unreadable. */
export function parsePageText(raw: unknown): PageText {
  if (!isRecord(raw) || typeof raw.text !== "string" || typeof raw.unreadable !== "boolean") {
    throw new InvalidModelOutputError("Model output is not a valid page text");
  }
  const text = raw.text.trim();
  return { text, unreadable: raw.unreadable || text === "" };
}

/** Request body of the transcription: one page as a base64 JPEG data URL. */
export const pageImageSchema = z.object({
  image: z.string().startsWith(PAGE_IMAGE_PREFIX).max(MAX_PAGE_IMAGE_CHARS),
});

export type PageImageInput = z.infer<typeof pageImageSchema>;
