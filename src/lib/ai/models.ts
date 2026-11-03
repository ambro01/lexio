/** Models selectable for flashcard generation. All of them support OpenRouter structured outputs. */
export const AI_MODELS = [
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5" },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash" },
  { id: "mistralai/mistral-large-4-0", label: "Mistral Large 4" },
] as const satisfies readonly { id: string; label: string }[];

export type AiModelId = (typeof AI_MODELS)[number]["id"];

/** Provisional until the production measurement picks the default. */
export const DEFAULT_AI_MODEL_ID: AiModelId = "anthropic/claude-haiku-5.5";

const MODEL_IDS: ReadonlySet<string> = new Set(AI_MODELS.map((model) => model.id));

export function isAiModelId(value: unknown): value is AiModelId {
  return typeof value === "string" && MODEL_IDS.has(value);
}
