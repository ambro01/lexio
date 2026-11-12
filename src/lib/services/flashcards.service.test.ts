import { describe, expect, it } from "vitest";
import {
  DuplicateWordError,
  FlashcardNotFoundError,
  FlashcardStoreError,
  TagLimitError,
  acceptProposalSet,
  addFlashcardTag,
  deleteFlashcard,
  findExistingWordKeys,
  listFlashcards,
  listTags,
  removeFlashcardTag,
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
  for (const method of [
    "select",
    "order",
    "eq",
    "update",
    "delete",
    "like",
    "in",
    "limit",
    "range",
    "maybeSingle",
    "overrideTypes",
  ]) {
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

    const { cards } = await listFlashcards(client, { offset: 0, limit: 50 });

    expect(cards[0]).toEqual({
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
    const { cards } = await listFlashcards(client, { offset: 0, limit: 50 });
    expect(cards[0].cefr).toBeNull();
  });

  it("orders by created_at desc then word_key and requests one extra row", async () => {
    const { client, calls } = stubClient({ data: [], error: null });

    await listFlashcards(client, { offset: 100, limit: 50 });

    expect(calls.filter((call) => call.method === "order").map((call) => call.args)).toEqual([
      ["created_at", { ascending: false }],
      ["word_key", { ascending: true }],
    ]);
    expect(calls.find((call) => call.method === "range")?.args).toEqual([100, 150]);
  });

  it("returns at most limit cards and sets hasMore from the extra row", async () => {
    const rows = [row, { ...row, id: "card-2" }, { ...row, id: "card-3" }];
    const { client } = stubClient({ data: rows, error: null });

    const page = await listFlashcards(client, { offset: 0, limit: 2 });

    expect(page.cards.map((card) => card.id)).toEqual(["card-1", "card-2"]);
    expect(page.hasMore).toBe(true);
  });

  it("sets hasMore to false when no extra row comes back", async () => {
    const { client } = stubClient({ data: [row, { ...row, id: "card-2" }], error: null });
    const page = await listFlashcards(client, { offset: 0, limit: 2 });
    expect(page.cards).toHaveLength(2);
    expect(page.hasMore).toBe(false);
  });

  it("maps a database error to FlashcardStoreError", async () => {
    const { client } = stubClient({ data: null, error: { code: "42501" } });
    await expect(listFlashcards(client, { offset: 0, limit: 50 })).rejects.toBeInstanceOf(FlashcardStoreError);
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

describe("addFlashcardTag", () => {
  it("calls add_flashcard_tag and maps the row", async () => {
    const { client, calls } = stubClient({
      data: [{ tag_id: "t1", tag_name: "Lesson 1", linked: true }],
      error: null,
    });

    const result = await addFlashcardTag(client, "card-1", " lesson  1 ");

    expect(result).toEqual({ tag: { id: "t1", name: "Lesson 1" }, linked: true });
    expect(calls[0]).toEqual({
      method: "rpc",
      args: ["add_flashcard_tag", { p_flashcard_id: "card-1", p_tag_name: " lesson  1 " }],
    });
  });

  it("maps P0002 to FlashcardNotFoundError", async () => {
    const { client } = stubClient({ data: null, error: { code: "P0002" } });
    await expect(addFlashcardTag(client, "card-1", "x")).rejects.toBeInstanceOf(FlashcardNotFoundError);
  });

  it("maps 54000 to TagLimitError", async () => {
    const { client } = stubClient({ data: null, error: { code: "54000" } });
    await expect(addFlashcardTag(client, "card-1", "x")).rejects.toBeInstanceOf(TagLimitError);
  });

  it("maps another error to FlashcardStoreError without user content", async () => {
    const { client } = stubClient({ data: null, error: { code: "22023", message: "Secret tag" } });
    const promise = addFlashcardTag(client, "card-1", "Secret tag");
    await expect(promise).rejects.toBeInstanceOf(FlashcardStoreError);
    await expect(promise).rejects.not.toThrow("Secret tag");
  });
});

describe("removeFlashcardTag", () => {
  it("deletes the link row of the card and tag", async () => {
    const { client, calls } = stubClient({ data: null, error: null });

    await removeFlashcardTag(client, "card-1", "t1");

    expect(calls.find((call) => call.method === "from")?.args).toEqual(["flashcard_tags"]);
    expect(calls.some((call) => call.method === "delete")).toBe(true);
    expect(calls.filter((call) => call.method === "eq").map((call) => call.args)).toEqual([
      ["flashcard_id", "card-1"],
      ["tag_id", "t1"],
    ]);
  });

  it("treats zero deleted rows as success", async () => {
    const { client } = stubClient({ data: [], error: null });
    await expect(removeFlashcardTag(client, "card-1", "t1")).resolves.toBeUndefined();
  });

  it("maps a database error to FlashcardStoreError", async () => {
    const { client } = stubClient({ data: null, error: { code: "42501" } });
    await expect(removeFlashcardTag(client, "card-1", "t1")).rejects.toBeInstanceOf(FlashcardStoreError);
  });
});

describe("listTags", () => {
  it("returns the user's tags ordered by name, at most 500", async () => {
    const { client, calls } = stubClient({ data: [{ id: "t1", name: "Lesson 1" }], error: null });

    const tags = await listTags(client);

    expect(tags).toEqual([{ id: "t1", name: "Lesson 1" }]);
    expect(calls.find((call) => call.method === "from")?.args).toEqual(["tags"]);
    expect(calls.find((call) => call.method === "order")?.args).toEqual(["name"]);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([500]);
  });

  it("maps a database error to FlashcardStoreError", async () => {
    const { client } = stubClient({ data: null, error: { code: "42501" } });
    await expect(listTags(client)).rejects.toBeInstanceOf(FlashcardStoreError);
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

  it("drops '*', which PostgREST would treat as a wildcard", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    await suggestTags(client, "le*s");
    expect(calls.find((call) => call.method === "like")?.args).toEqual(["name_key", "les%"]);
  });

  it("does not filter when the prefix is blank", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    await suggestTags(client, "   ");
    expect(calls.some((call) => call.method === "like")).toBe(false);
  });
});

describe("acceptProposalSet", () => {
  const input = {
    tagName: "Lesson 1",
    model: "anthropic/claude-haiku-5.5",
    items: [
      {
        word: "give up",
        translation: "poddać się",
        additionalMeanings: [],
        exampleSentence: "Don't give up.",
        cefr: "B1" as const,
        outcome: "accepted_unchanged" as const,
      },
    ],
    source: "lesson" as const,
  };

  it("calls accept_proposal_set with snake_case args and maps the counts", async () => {
    const { client, calls } = stubClient({
      data: [{ created_count: 1, merged_count: 2, rejected_count: 3 }],
      error: null,
    });

    const result = await acceptProposalSet(client, input);

    expect(result).toEqual({ created: 1, merged: 2, rejected: 3 });
    expect(calls[0]).toEqual({
      method: "rpc",
      args: [
        "accept_proposal_set",
        { p_tag_name: "Lesson 1", p_model: input.model, p_items: input.items, p_source: "lesson" },
      ],
    });
  });

  it("passes the manual source and a null tag for a manual save without a tag", async () => {
    const { client, calls } = stubClient({
      data: [{ created_count: 1, merged_count: 0, rejected_count: 0 }],
      error: null,
    });

    await acceptProposalSet(client, { ...input, tagName: null, source: "manual" });

    expect(calls[0]).toEqual({
      method: "rpc",
      args: [
        "accept_proposal_set",
        { p_tag_name: null, p_model: input.model, p_items: input.items, p_source: "manual" },
      ],
    });
  });

  it("maps a database error to FlashcardStoreError without user content", async () => {
    const { client } = stubClient({ data: null, error: { code: "22023", message: "give up Lesson 1" } });
    const promise = acceptProposalSet(client, input);
    await expect(promise).rejects.toBeInstanceOf(FlashcardStoreError);
    await expect(promise).rejects.not.toThrow("give up");
    await expect(promise).rejects.not.toThrow("Lesson 1");
  });
});

describe("findExistingWordKeys", () => {
  it("queries folded, unique keys and returns the found ones", async () => {
    const { client, calls } = stubClient({ data: [{ word_key: "give up" }], error: null });

    const keys = await findExistingWordKeys(client, ["Give  Up", " give up", "Look\tAfter"]);

    expect(keys).toEqual(new Set(["give up"]));
    expect(calls.find((call) => call.method === "from")?.args).toEqual(["flashcards"]);
    expect(calls.find((call) => call.method === "in")?.args).toEqual(["word_key", ["give up", "look after"]]);
  });

  it("skips the query for an empty list", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    expect(await findExistingWordKeys(client, [])).toEqual(new Set());
    expect(calls).toEqual([]);
  });

  it("maps a database error to FlashcardStoreError", async () => {
    const { client } = stubClient({ data: null, error: { code: "42501" } });
    await expect(findExistingWordKeys(client, ["give up"])).rejects.toBeInstanceOf(FlashcardStoreError);
  });
});
