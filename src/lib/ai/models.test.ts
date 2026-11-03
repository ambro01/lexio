import { describe, expect, it } from "vitest";
import { AI_MODELS, DEFAULT_AI_MODEL_ID, isAiModelId } from "./models";

describe("AI_MODELS", () => {
  it("holds exactly three unique ids", () => {
    const ids = AI_MODELS.map((model) => model.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it("includes the default model", () => {
    expect(AI_MODELS.some((model) => model.id === DEFAULT_AI_MODEL_ID)).toBe(true);
  });
});

describe("isAiModelId", () => {
  it("accepts every configured id", () => {
    for (const model of AI_MODELS) {
      expect(isAiModelId(model.id)).toBe(true);
    }
  });

  it("rejects unknown ids and non-strings", () => {
    expect(isAiModelId("foo/bar")).toBe(false);
    expect(isAiModelId("")).toBe(false);
    expect(isAiModelId(undefined)).toBe(false);
    expect(isAiModelId(42)).toBe(false);
  });
});
