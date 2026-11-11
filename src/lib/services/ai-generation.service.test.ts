import { describe, expect, it } from "vitest";
import {
  OPENROUTER_URL,
  UpstreamError,
  UpstreamTimeoutError,
  fillWord,
  generateProposals,
} from "./ai-generation.service";
import { InvalidModelOutputError } from "@/lib/ai/proposals";
import { WORD_FILL_JSON_SCHEMA } from "@/lib/ai/word-fill";

const proposal = {
  word: "give up",
  translation: "poddać się",
  additionalMeanings: [],
  exampleSentence: "Don't give up now.",
  cefr: "B1",
};

function completion(content: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ model: "anthropic/claude-haiku-5.5", choices: [{ message: { content } }], ...extra });
}

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(respond: (init: RequestInit | undefined) => Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url, init });
    return respond(init);
  };
  return { calls, fetchImpl };
}

const baseOpts = { text: "I will never give up.", model: "anthropic/claude-haiku-5.5", apiKey: "test-key" } as const;

describe("generateProposals", () => {
  it("sends model, json_schema and auth header and returns proposals with usage", async () => {
    const { calls, fetchImpl } = stubFetch(() =>
      Promise.resolve(
        completion(JSON.stringify({ proposals: [proposal] }), {
          usage: { prompt_tokens: 120, completion_tokens: 40, cost: 0.0012 },
        }),
      ),
    );

    const result = await generateProposals({ ...baseOpts, fetchImpl });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.url).toBe(OPENROUTER_URL);
    expect(call.init?.method).toBe("POST");
    const headers = new Headers(call.init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-key");
    expect(headers.get("X-Title")).toBe("Lexio");
    const body = JSON.parse(call.init?.body as string) as {
      model: string;
      messages: { role: string; content: string }[];
      response_format: { type: string; json_schema: { strict: boolean } };
      usage: { include: boolean };
    };
    expect(body.model).toBe("anthropic/claude-haiku-5.5");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.usage.include).toBe(true);
    expect(body.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(body.messages[1]?.content).toContain(baseOpts.text);

    expect(result.proposals).toEqual([proposal]);
    expect(result.dropped).toBe(0);
    expect(result.model).toBe("anthropic/claude-haiku-5.5");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.usage).toEqual({ promptTokens: 120, completionTokens: 40, costUsd: 0.0012 });
  });

  it("maps HTTP 500 to UpstreamError", async () => {
    const { fetchImpl } = stubFetch(() => Promise.resolve(new Response("boom", { status: 500 })));
    await expect(generateProposals({ ...baseOpts, fetchImpl })).rejects.toBeInstanceOf(UpstreamError);
  });

  it("maps a network failure to UpstreamError", async () => {
    const { fetchImpl } = stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    await expect(generateProposals({ ...baseOpts, fetchImpl })).rejects.toBeInstanceOf(UpstreamError);
  });

  it("maps non-JSON message content to UpstreamError", async () => {
    const { fetchImpl } = stubFetch(() => Promise.resolve(completion("Sure! Here are your words:")));
    await expect(generateProposals({ ...baseOpts, fetchImpl })).rejects.toBeInstanceOf(UpstreamError);
  });

  it("includes finish_reason when truncated content is not JSON", async () => {
    const { fetchImpl } = stubFetch(() =>
      Promise.resolve(
        Response.json({ choices: [{ message: { content: '{"proposals": [' }, finish_reason: "length" }] }),
      ),
    );
    await expect(generateProposals({ ...baseOpts, fetchImpl })).rejects.toThrow("finish_reason: length");
  });

  it("includes the OpenRouter error message for a non-2xx response", async () => {
    const { fetchImpl } = stubFetch(() =>
      Promise.resolve(Response.json({ error: { message: "Provider rejected response_format" } }, { status: 400 })),
    );
    await expect(generateProposals({ ...baseOpts, fetchImpl })).rejects.toThrow(
      "HTTP 400 (error: Provider rejected response_format)",
    );
  });

  it("maps missing message content to UpstreamError", async () => {
    const { fetchImpl } = stubFetch(() => Promise.resolve(Response.json({ choices: [] })));
    await expect(generateProposals({ ...baseOpts, fetchImpl })).rejects.toBeInstanceOf(UpstreamError);
  });

  it("propagates InvalidModelOutputError for a bad root", async () => {
    const { fetchImpl } = stubFetch(() => Promise.resolve(completion(JSON.stringify([proposal]))));
    await expect(generateProposals({ ...baseOpts, fetchImpl })).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it("maps a timeout abort to UpstreamTimeoutError", async () => {
    const { fetchImpl } = stubFetch(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => {
            reject(signal.reason as Error);
          });
        }),
    );
    await expect(generateProposals({ ...baseOpts, fetchImpl, timeoutMs: 10 })).rejects.toBeInstanceOf(
      UpstreamTimeoutError,
    );
  });
});

describe("fillWord", () => {
  const fill = {
    word: "bank",
    translation: "brzeg",
    additionalMeanings: ["bank"],
    exampleSentence: "We sat on the river bank.",
    cefr: "A2",
  };
  const fillOpts = { word: "bank", model: "anthropic/claude-haiku-5.5", apiKey: "test-key" } as const;

  interface SentBody {
    messages: { role: string; content: string }[];
    response_format: { json_schema: { name: string; strict: boolean; schema: unknown } };
    max_tokens: number;
  }

  it("sends the word-fill schema and the Word/Context message and returns the proposal", async () => {
    const { calls, fetchImpl } = stubFetch(() =>
      Promise.resolve(completion(JSON.stringify(fill), { usage: { prompt_tokens: 90, completion_tokens: 30 } })),
    );

    const result = await fillWord({ ...fillOpts, context: "I sat on the bank of the river", fetchImpl });

    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0]?.init?.body as string) as SentBody;
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema).toEqual(WORD_FILL_JSON_SCHEMA);
    expect(body.max_tokens).toBe(800);
    expect(body.messages[1]?.content).toBe("Word: bank\nContext: I sat on the bank of the river");

    expect(result.proposal).toEqual(fill);
    expect(result.model).toBe("anthropic/claude-haiku-5.5");
    expect(result.usage).toEqual({ promptTokens: 90, completionTokens: 30, costUsd: undefined });
  });

  it("sends only the Word line without a context", async () => {
    const { calls, fetchImpl } = stubFetch(() => Promise.resolve(completion(JSON.stringify(fill))));
    await fillWord({ ...fillOpts, fetchImpl });
    const body = JSON.parse(calls[0]?.init?.body as string) as SentBody;
    expect(body.messages[1]?.content).toBe("Word: bank");
  });

  it("throws InvalidModelOutputError for an invalid fill", async () => {
    const { fetchImpl } = stubFetch(() => Promise.resolve(completion(JSON.stringify({ ...fill, cefr: "Z9" }))));
    await expect(fillWord({ ...fillOpts, fetchImpl })).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it("maps HTTP 500 to UpstreamError", async () => {
    const { fetchImpl } = stubFetch(() => Promise.resolve(new Response("boom", { status: 500 })));
    await expect(fillWord({ ...fillOpts, fetchImpl })).rejects.toBeInstanceOf(UpstreamError);
  });
});
