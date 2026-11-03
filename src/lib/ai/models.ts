/**
 * Models selectable for flashcard generation. All of them support OpenRouter structured outputs and passed the
 * production measurement (< 60 s on a ~2,000-word lesson) — see context/changes/openrouter-generation-spike/measurements.md.
 */
export const AI_MODELS = [
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5" },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
] as const satisfies readonly { id: string; label: string }[];

export type AiModelId = (typeof AI_MODELS)[number]["id"];

/** Fastest and cheapest model in the production measurement. */
export const DEFAULT_AI_MODEL_ID: AiModelId = "anthropic/claude-haiku-5.5";

const MODEL_IDS: ReadonlySet<string> = new Set(AI_MODELS.map((model) => model.id));

export function isAiModelId(value: unknown): value is AiModelId {
  return typeof value === "string" && MODEL_IDS.has(value);
}
