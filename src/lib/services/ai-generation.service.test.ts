import { describe, expect, it } from "vitest";
import { OPENROUTER_URL, UpstreamError, UpstreamTimeoutError, generateProposals } from "./ai-generation.service";
import { InvalidModelOutputError } from "@/lib/ai/proposals";

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
