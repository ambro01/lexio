import { DEFAULT_AI_MODEL_ID, type AiModelId } from "@/lib/ai/models";
import { getProfile, type ProfilesClient } from "@/lib/services/profiles.service";

/** Outcome of a best-effort lookup, reported in log lines. */
export type Lookup = "ok" | "unavailable" | "failed";
export type ModelSource = "request" | "profile" | "default";

/**
 * The model from the user's profile, else the default (FR-016). Never throws: a missing client or a failed
 * read only falls back to the default, reported as `profileLookup` in the log line.
 */
export async function resolveProfileModel(
  client: ProfilesClient | null,
): Promise<{ model: AiModelId; modelSource: ModelSource; profileLookup: Lookup }> {
  if (!client) {
    return { model: DEFAULT_AI_MODEL_ID, modelSource: "default", profileLookup: "unavailable" };
  }
  try {
    const { aiModel } = await getProfile(client);
    return aiModel
      ? { model: aiModel, modelSource: "profile", profileLookup: "ok" }
      : { model: DEFAULT_AI_MODEL_ID, modelSource: "default", profileLookup: "ok" };
  } catch {
    return { model: DEFAULT_AI_MODEL_ID, modelSource: "default", profileLookup: "failed" };
  }
}
