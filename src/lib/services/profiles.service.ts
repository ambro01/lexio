import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { isAiModelId } from "@/lib/ai/models";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/ai/proposals";
import type { Profile } from "@/types";

export type ProfilesClient = SupabaseClient<Database>;

/** Any profile storage failure. The message carries only the database error code, never user content. */
export class ProfileStoreError extends Error {
  override name = "ProfileStoreError";
}

const PROFILE_SELECT = "cefr_level, ai_model";

interface ProfileRow {
  cefr_level: string | null;
  ai_model: string | null;
}

interface PostgrestErrorLike {
  code?: string;
}

function storeError(operation: string, error: PostgrestErrorLike): ProfileStoreError {
  return new ProfileStoreError(`Profile ${operation} failed${error.code ? ` (${error.code})` : ""}`);
}

function toCefr(value: string | null): CefrLevel | null {
  return CEFR_LEVELS.find((level) => level === value) ?? null;
}

/** A stored model that is no longer configured reads as "not set", so the default is used. */
function toProfile(row: ProfileRow | null): Profile {
  return {
    cefrLevel: toCefr(row?.cefr_level ?? null),
    aiModel: isAiModelId(row?.ai_model) ? row.ai_model : null,
  };
}

/** The signed-in user's profile; both fields `null` when the user has not saved one yet. */
export async function getProfile(client: ProfilesClient): Promise<Profile> {
  const { data, error } = await client.from("profiles").select(PROFILE_SELECT).maybeSingle();
  if (error) {
    throw storeError("read", error);
  }
  return toProfile(data);
}

/** Creates or replaces the signed-in user's profile (the row's user_id defaults to auth.uid()). */
export async function saveProfile(client: ProfilesClient, profile: Profile): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .upsert(
      { cefr_level: profile.cefrLevel, ai_model: profile.aiModel, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select(PROFILE_SELECT)
    .single();
  if (error) {
    throw storeError("save", error);
  }
  return toProfile(data);
}
