import type { AiModelId } from "@/lib/ai/models";
import { PROPOSALS_JSON_SCHEMA, parseProposals, type Proposal } from "@/lib/ai/proposals";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const APP_URL = "https://lexio.rafalambro.workers.dev";
const APP_TITLE = "Lexio";
const DEFAULT_TIMEOUT_MS = 90000;
const MAX_TOKENS = 8000;
const TEMPERATURE = 0.2;

export const SYSTEM_PROMPT = [
  "You help a Polish adult learner of English build vocabulary flashcards from a lesson text.",
  "Pick the words and phrasal verbs from the lesson that are worth learning.",
  "Skip exercise instructions, names of people and places, and trivial function words such as articles, pronouns, basic prepositions and auxiliary verbs.",
  "Give each word in its English base form; phrasal verbs are allowed.",
  "Translate each word into Polish in the meaning used in the text.",
  "List other common meanings of the word in Polish, or an empty list if there are none.",
  "Write one short English example sentence using the word.",
  "Estimate the CEFR level (A1, A2, B1, B2, C1 or C2) of each word.",
  "List each word only once.",
  "Answer only with JSON matching the provided schema.",
].join(" ");

export interface GenerationUsage {
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
}

export interface GenerationResult {
  proposals: Proposal[];
  dropped: number;
  model: string;
  durationMs: number;
  usage: GenerationUsage;
}

export interface GenerateProposalsOptions {
  text: string;
  model: AiModelId;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** OpenRouter failed: non-2xx status, network failure, or a response without usable JSON content. */
export class UpstreamError extends Error {
  override name = "UpstreamError";
  readonly status: number | undefined;

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.status = options?.status;
  }
}

/** OpenRouter did not answer within the timeout. */
export class UpstreamTimeoutError extends Error {
  override name = "UpstreamTimeoutError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `AbortSignal.timeout` rejects with a DOMException named "TimeoutError" (some runtimes report "AbortError"). */
function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false;
  }
  return error.name === "TimeoutError" || error.name === "AbortError";
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readUsage(payload: Record<string, unknown>): GenerationUsage {
  const usage = payload.usage;
  if (!isRecord(usage)) {
    return {};
  }
  return {
    promptTokens: optionalNumber(usage.prompt_tokens),
    completionTokens: optionalNumber(usage.completion_tokens),
    costUsd: optionalNumber(usage.cost),
  };
}

function readContent(payload: Record<string, unknown>): string | null {
  const choices = payload.choices;
  if (!Array.isArray(choices)) {
    return null;
  }
  const first: unknown = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) {
    return null;
  }
  const content = first.message.content;
  return typeof content === "string" ? content : null;
}

/** Sends the lesson text to OpenRouter and returns validated flashcard proposals with measurement data. */
export async function generateProposals(opts: GenerateProposalsOptions): Promise<GenerationResult> {
  const fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const started = Date.now();

  let payload: unknown;
  try {
    const response = await fetchImpl(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": APP_URL,
        "X-Title": APP_TITLE,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Lesson text:\n\n${opts.text}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "flashcard_proposals", strict: true, schema: PROPOSALS_JSON_SCHEMA },
        },
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new UpstreamError(`OpenRouter responded with HTTP ${response.status}`, { status: response.status });
    }
    payload = await response.json();
  } catch (error) {
    if (error instanceof UpstreamError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new UpstreamTimeoutError("OpenRouter request timed out", { cause: error });
    }
    throw new UpstreamError("OpenRouter request failed", { cause: error });
  }
  const durationMs = Date.now() - started;

  if (!isRecord(payload)) {
    throw new UpstreamError("OpenRouter response is not a JSON object");
  }
  const content = readContent(payload);
  if (content === null) {
    throw new UpstreamError("OpenRouter response has no message content");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new UpstreamError("Model message content is not JSON", { cause: error });
  }

  const { proposals, dropped } = parseProposals(parsed);
  return {
    proposals,
    dropped,
    model: typeof payload.model === "string" ? payload.model : opts.model,
    durationMs,
    usage: readUsage(payload),
  };
}
