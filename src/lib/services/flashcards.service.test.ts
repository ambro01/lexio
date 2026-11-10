import { describe, expect, it } from "vitest";
import {
  DuplicateWordError,
  FlashcardNotFoundError,
  FlashcardStoreError,
  deleteFlashcard,
  listFlashcards,
  saveFlashcard,
  suggestTags,
  updateFlashcard,
  type FlashcardsClient,
} from "./flashcards.service";

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
  for (const method of ["select", "order", "eq", "update", "delete", "like", "limit", "maybeSingle", "overrideTypes"]) {
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
    rpc: (fn: string, params: unknown) => {
      calls.push({ method: "rpc", args: [fn, params] });
      return Promise.resolve(result);
    },
  };
  return { client: client as unknown as FlashcardsClient, calls };
}

const row = {
  id: "card-1",
  word: "Give up",
  translation: "poddać się",
  additional_meanings: ["zrezygnować"],
  example_sentence: "Don't give up.",
  cefr: "B1",
  created_at: "2026-11-10T10:00:00Z",
  updated_at: "2026-11-10T10:00:00Z",
  flashcard_tags: [{ tag: { id: "t2", name: "Lesson 2" } }, { tag: { id: "t1", name: "Lesson 1" } }, { tag: null }],
};

describe("saveFlashcard", () => {
  it("calls save_flashcard with snake_case args and maps the result", async () => {
    const { client, calls } = stubClient({ data: [{ flashcard_id: "card-1", created: false }], error: null });

    const result = await saveFlashcard(client, {
      word: "give  up",
      translation: "poddać się",
      additionalMeanings: [],
      exampleSentence: "",
      cefr: null,
      tagNames: ["Lesson 2"],
    });

    expect(result).toEqual({ id: "card-1", created: false });
    expect(calls[0]).toEqual({
      method: "rpc",
      args: [
        "save_flashcard",
        {
          p_word: "give  up",
          p_translation: "poddać się",
          p_additional_meanings: [],
          p_example_sentence: "",
          p_cefr: null,
          p_tag_names: ["Lesson 2"],
        },
      ],
    });
  });

  it("maps a database error to FlashcardStoreError without user content", async () => {
    const { client } = stubClient({ data: null, error: { code: "P0001", message: "word give up failed" } });
    const promise = saveFlashcard(client, {
      word: "give up",
      translation: "x",
      additionalMeanings: [],
      exampleSentence: "",
      cefr: null,
      tagNames: [],
    });
    await expect(promise).rejects.toBeInstanceOf(FlashcardStoreError);
    await expect(promise).rejects.not.toThrow("give up");
  });
});

describe("listFlashcards", () => {
  it("maps rows to domain objects with sorted tags and drops empty links", async () => {
    const { client } = stubClient({ data: [row], error: null });

    const [card] = await listFlashcards(client);

    expect(card).toEqual({
      id: "card-1",
      word: "Give up",
      translation: "poddać się",
      additionalMeanings: ["zrezygnować"],
      exampleSentence: "Don't give up.",
      cefr: "B1",
      tags: [
        { id: "t1", name: "Lesson 1" },
        { id: "t2", name: "Lesson 2" },
      ],
      createdAt: "2026-11-10T10:00:00Z",
      updatedAt: "2026-11-10T10:00:00Z",
    });
  });

  it("maps an unknown CEFR value to null", async () => {
    const { client } = stubClient({ data: [{ ...row, cefr: null }], error: null });
    const [card] = await listFlashcards(client);
    expect(card.cefr).toBeNull();
  });
});

describe("updateFlashcard", () => {
  it("sends only the changed fields in snake_case", async () => {
    const { client, calls } = stubClient({ data: row, error: null });

    await updateFlashcard(client, "card-1", { exampleSentence: "New one.", cefr: "B2" });

    expect(calls.find((call) => call.method === "update")?.args[0]).toEqual({
      example_sentence: "New one.",
      cefr: "B2",
    });
    expect(calls.find((call) => call.method === "eq")?.args).toEqual(["id", "card-1"]);
  });

  it("maps a unique violation to DuplicateWordError", async () => {
    const { client } = stubClient({ data: null, error: { code: "23505" } });
    await expect(updateFlashcard(client, "card-1", { word: "give up" })).rejects.toBeInstanceOf(DuplicateWordError);
  });

  it("maps no visible row to FlashcardNotFoundError", async () => {
    const { client } = stubClient({ data: null, error: null });
    await expect(updateFlashcard(client, "card-1", { word: "x" })).rejects.toBeInstanceOf(FlashcardNotFoundError);
  });

  it("maps another error to FlashcardStoreError", async () => {
    const { client } = stubClient({ data: null, error: { code: "42501" } });
    await expect(updateFlashcard(client, "card-1", { word: "x" })).rejects.toBeInstanceOf(FlashcardStoreError);
  });
});

describe("deleteFlashcard", () => {
  it("resolves when a row was deleted", async () => {
    const { client } = stubClient({ data: [{ id: "card-1" }], error: null });
    await expect(deleteFlashcard(client, "card-1")).resolves.toBeUndefined();
  });

  it("maps zero deleted rows to FlashcardNotFoundError", async () => {
    const { client } = stubClient({ data: [], error: null });
    await expect(deleteFlashcard(client, "card-1")).rejects.toBeInstanceOf(FlashcardNotFoundError);
  });
});

describe("suggestTags", () => {
  it("filters by the folded, escaped prefix on name_key", async () => {
    const { client, calls } = stubClient({ data: [{ id: "t1", name: "Lesson 1" }], error: null });

    const tags = await suggestTags(client, "  LES_ ");

    expect(tags).toEqual([{ id: "t1", name: "Lesson 1" }]);
    expect(calls.find((call) => call.method === "like")?.args).toEqual(["name_key", "les\\_%"]);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([20]);
  });

  it("does not filter when the prefix is blank", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    await suggestTags(client, "   ");
    expect(calls.some((call) => call.method === "like")).toBe(false);
  });
});
