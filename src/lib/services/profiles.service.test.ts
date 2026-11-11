import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileStoreError, getProfile, saveProfile, type ProfilesClient } from "./profiles.service";

interface Result {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface Call {
  method: string;
  args: unknown[];
}

/** Minimal stand-in for the Supabase query builder: records every call and resolves to `result`. */
function stubClient(result: Result) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {
    then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ["select", "upsert", "maybeSingle", "single"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };
  return { client: client as unknown as ProfilesClient, calls };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getProfile", () => {
  it("returns nulls when the user has no profile row", async () => {
    const { client, calls } = stubClient({ data: null, error: null });

    expect(await getProfile(client)).toEqual({ cefrLevel: null, aiModel: null });
    expect(calls.find((call) => call.method === "from")?.args).toEqual(["profiles"]);
    expect(calls.some((call) => call.method === "maybeSingle")).toBe(true);
  });

  it("maps a stored row", async () => {
    const { client } = stubClient({ data: { cefr_level: "B1", ai_model: "openai/gpt-6-luna" }, error: null });
    expect(await getProfile(client)).toEqual({ cefrLevel: "B1", aiModel: "openai/gpt-6-luna" });
  });

  it("reads a model that is no longer configured as null", async () => {
    const { client } = stubClient({ data: { cefr_level: "A2", ai_model: "retired/model-1" }, error: null });
    expect(await getProfile(client)).toEqual({ cefrLevel: "A2", aiModel: null });
  });

  it("maps a database error to ProfileStoreError carrying only the code", async () => {
    const { client } = stubClient({ data: null, error: { code: "42501", message: "secret B1 detail" } });
    const promise = getProfile(client);
    await expect(promise).rejects.toBeInstanceOf(ProfileStoreError);
    await expect(promise).rejects.toThrow("Profile read failed (42501)");
    await expect(promise).rejects.not.toThrow("secret");
  });
});

describe("saveProfile", () => {
  it("upserts the caller's row in snake_case (updated_at left to the database) and maps the saved row", async () => {
    const { client, calls } = stubClient({
      data: { cefr_level: "C1", ai_model: "google/gemini-3.8-flash" },
      error: null,
    });

    const saved = await saveProfile(client, { cefrLevel: "C1", aiModel: "google/gemini-3.8-flash" });

    expect(saved).toEqual({ cefrLevel: "C1", aiModel: "google/gemini-3.8-flash" });
    expect(calls.find((call) => call.method === "upsert")?.args).toEqual([
      { cefr_level: "C1", ai_model: "google/gemini-3.8-flash" },
      { onConflict: "user_id" },
    ]);
    expect(calls.some((call) => call.method === "single")).toBe(true);
  });

  it("saves nulls to reset both settings", async () => {
    const { client, calls } = stubClient({ data: { cefr_level: null, ai_model: null }, error: null });

    expect(await saveProfile(client, { cefrLevel: null, aiModel: null })).toEqual({ cefrLevel: null, aiModel: null });
    expect(calls.find((call) => call.method === "upsert")?.args[0]).toMatchObject({ cefr_level: null, ai_model: null });
  });

  it("maps a database error to ProfileStoreError without user content", async () => {
    const { client } = stubClient({ data: null, error: { code: "23514", message: "cefr_level B1 violates check" } });
    const promise = saveProfile(client, { cefrLevel: "B1", aiModel: null });
    await expect(promise).rejects.toBeInstanceOf(ProfileStoreError);
    await expect(promise).rejects.not.toThrow("B1");
  });
});
