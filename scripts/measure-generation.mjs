// Measures AI flashcard generation on a deployed Lexio app: one request per model with a ~2,000-word lesson.
// Zero dependencies on purpose. Needs an existing, confirmed account (email confirmation is on in production):
//   LEXIO_EMAIL=... LEXIO_PASSWORD=... npm run measure:generation
// Optional: BASE_URL (default production), MODELS (comma list, default all configured models).

import { readFile } from "node:fs/promises";
import { AI_MODELS } from "../src/lib/ai/models.ts";

const BASE_URL = process.env.BASE_URL ?? "https://lexio.rafalambro.workers.dev";
const BUDGET_MS = 60_000;
const SAMPLE_SIZE = 10;
const email = process.env.LEXIO_EMAIL;
const password = process.env.LEXIO_PASSWORD;
const models = process.env.MODELS
  ? process.env.MODELS.split(",")
      .map((m) => m.trim())
      .filter(Boolean)
  : AI_MODELS.map((m) => m.id);

if (!email || !password) {
  console.error("Set LEXIO_EMAIL and LEXIO_PASSWORD (an existing, confirmed account).");
  process.exit(2);
}

const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function signIn() {
  const response = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    redirect: "manual",
    headers: { Origin: BASE_URL, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }).toString(),
  });
  storeCookies(response);
  const location = response.headers.get("location") ?? "";
  if (response.status !== 302 || location.includes("error=")) {
    throw new Error(`Sign-in failed: ${response.status} ${decodeURIComponent(location)}`);
  }
}

async function generate(text, model) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE_URL}/api/ai/proposals`, {
      method: "POST",
      headers: { Cookie: cookieHeader(), Origin: BASE_URL, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model }),
      signal: AbortSignal.timeout(150_000),
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, wallMs: Date.now() - started, body };
  } catch (error) {
    return { status: 0, wallMs: Date.now() - started, body: { error: "network", message: String(error) } };
  }
}

const text = await readFile(new URL("./fixtures/lesson-sample.txt", import.meta.url), "utf8");
console.log(`Base URL: ${BASE_URL}`);
console.log(`Models: ${models.join(", ")}\n`);

await signIn();

const rows = [];
const samples = [];
for (const model of models) {
  process.stdout.write(`… ${model} `);
  const { status, wallMs, body } = await generate(text, model);
  const meta = body?.meta;
  const ok = status === 200 && wallMs < BUDGET_MS;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${status} in ${wallMs} ms${status === 200 ? "" : ` — ${body?.message ?? "no body"}`}`,
  );
  rows.push({
    model,
    status,
    wallMs,
    durationMs: meta?.durationMs ?? "",
    words: meta?.inputWords ?? "",
    proposals: body?.proposals?.length ?? "",
    dropped: meta?.dropped ?? "",
    promptTok: meta?.usage?.promptTokens ?? "",
    complTok: meta?.usage?.completionTokens ?? "",
    costUsd: meta?.usage?.costUsd ?? "",
    ok,
  });
  if (status === 200) samples.push({ model, proposals: body.proposals.slice(0, SAMPLE_SIZE) });
}

console.log("");
console.table(rows);

for (const { model, proposals } of samples) {
  console.log(`\nSample from ${model}:`);
  for (const p of proposals) {
    const more = p.additionalMeanings.length ? ` (${p.additionalMeanings.join(", ")})` : "";
    console.log(`  [${p.cefr}] ${p.word} — ${p.translation}${more}\n        ${p.exampleSentence}`);
  }
}

const failed = rows.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\n${failed.length} model(s) failed or exceeded ${BUDGET_MS} ms: ${failed.map((r) => r.model).join(", ")}`
    : `\nAll ${rows.length} models answered under ${BUDGET_MS} ms`,
);
process.exit(failed.length ? 1 : 0);
