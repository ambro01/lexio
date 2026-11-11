// RLS / data-contract check: proves per-user isolation and the one-word rule for flashcards, tags and their links,
// through the same anon-key client the app uses. Run against a Supabase instance with the migration applied:
// SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_KEY=<anon key> node scripts/check-rls.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_KEY must be set");
  process.exit(2);
}

const TABLES = ["flashcards", "tags", "flashcard_tags"];
const password = "Rls-Check-Passw0rd!";
const ts = Date.now();

function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let failed = 0;

function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -> ${detail}` : ""}`);
  if (!ok) failed++;
}

// Each check returns [ok, detail]; a thrown error counts as a failure.
async function step(name, run) {
  try {
    const [ok, detail] = await run();
    report(name, ok, detail);
    return ok;
  } catch (error) {
    report(name, false, error instanceof Error ? error.message : String(error));
    return false;
  }
}

function finish() {
  console.log(failed ? `\n${failed} step(s) failed` : "\nAll RLS checks passed");
  process.exit(failed ? 1 : 0);
}

async function signUp(email) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`signup ${email}: ${error.message}`);
  if (!data.session || !data.user) throw new Error(`signup ${email}: no session returned (email confirmation on?)`);
  return { client, userId: data.user.id };
}

async function save(client, word, translation, tagNames) {
  return client.rpc("save_flashcard", {
    p_word: word,
    p_translation: translation,
    p_additional_meanings: [],
    p_example_sentence: "",
    p_cefr: null,
    p_tag_names: tagNames,
  });
}

function acceptItem(word, outcome, translation = `tłumaczenie ${word}`) {
  return { word, translation, additionalMeanings: [], exampleSentence: "", cefr: null, outcome };
}

async function acceptSet(client, tagName, items) {
  return client.rpc("accept_proposal_set", { p_tag_name: tagName, p_model: "check-rls", p_items: items });
}

// Row counts of everything an accepted set can write, to prove a failed call wrote nothing.
async function writeCounts(client) {
  const counts = {};
  for (const table of [...TABLES, "proposal_outcomes"]) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    counts[table] = count;
  }
  return counts;
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

async function cardTagNames(client, cardId) {
  const links = await client.from("flashcard_tags").select("tag_id").eq("flashcard_id", cardId);
  if (links.error) throw new Error(links.error.message);
  const ids = links.data.map((l) => l.tag_id);
  if (ids.length === 0) return [];
  const tags = await client.from("tags").select("name").in("id", ids);
  if (tags.error) throw new Error(tags.error.message);
  return tags.data.map((t) => t.name).sort();
}

let a;
let b;
const signedUp = await step("sign up two users", async () => {
  a = await signUp(`rls-a-${ts}@example.com`);
  b = await signUp(`rls-b-${ts}@example.com`);
  return [a.userId !== b.userId, `A=${a.userId} B=${b.userId}`];
});
if (!signedUp) finish();

const anon = newClient();
let aCardId;
let aTagIds = [];
let bCardId;
let bTagId;

await step("A: save 'Give up' creates a card", async () => {
  const { data, error } = await save(a.client, "Give up", "poddać się", ["Lesson 1"]);
  if (error) return [false, error.message];
  const row = firstRow(data);
  aCardId = row?.flashcard_id;
  return [row?.created === true && Boolean(aCardId), JSON.stringify(row)];
});

await step("A: save 'give  up' returns the same card, content and tags merged", async () => {
  const { data, error } = await save(a.client, "give  up", "inna treść", ["lesson 1", "Lesson 2"]);
  if (error) return [false, error.message];
  const row = firstRow(data);
  const card = await a.client.from("flashcards").select("translation").eq("id", aCardId).single();
  if (card.error) return [false, card.error.message];
  const names = await cardTagNames(a.client, aCardId);
  const allTags = await a.client.from("tags").select("id, name");
  if (allTags.error) return [false, allTags.error.message];
  aTagIds = allTags.data.map((t) => t.id);
  const ok =
    row?.flashcard_id === aCardId &&
    row.created === false &&
    card.data.translation === "poddać się" &&
    names.join("|") === "Lesson 1|Lesson 2" &&
    allTags.data.length === 2;
  return [
    ok,
    `${JSON.stringify(row)} translation=${card.data.translation} tags=${names.join(",")} total=${allTags.data.length}`,
  ];
});

await step("A: save '\\tgive up\\n' (tab/newline) returns the same card", async () => {
  const { data, error } = await save(a.client, "\tgive up\n", "inna treść", ["\tLesson 2\n"]);
  if (error) return [false, error.message];
  const row = firstRow(data);
  const allTags = await a.client.from("tags").select("id");
  if (allTags.error) return [false, allTags.error.message];
  const ok = row?.flashcard_id === aCardId && row.created === false && allTags.data.length === 2;
  return [ok, `${JSON.stringify(row)} tags total=${allTags.data.length}`];
});

await step("A: a word made only of whitespace is rejected", async () => {
  const { error } = await save(a.client, "\t\n", "coś", []);
  return [error !== null, error?.message ?? "accepted"];
});

await step("A: more than 20 tags in one save is rejected", async () => {
  const tags = Array.from({ length: 21 }, (_, i) => `t${String(i)}`);
  const { error } = await save(a.client, "too many tags", "za dużo", tags);
  return [error !== null, error?.message ?? "accepted"];
});

await step("B: select on all tables returns no rows of A", async () => {
  const leaks = [];
  for (const table of TABLES) {
    const { data, error } = await b.client.from(table).select("*");
    if (error) return [false, `${table}: ${error.message}`];
    if (data.some((r) => r.user_id === a.userId)) leaks.push(table);
  }
  return [leaks.length === 0, leaks.length ? `leaked: ${leaks.join(",")}` : ""];
});

await step("B: select A's card by id returns nothing", async () => {
  const { data, error } = await b.client.from("flashcards").select("id").eq("id", aCardId);
  if (error) return [false, error.message];
  return [data.length === 0, `${data.length} row(s)`];
});

await step("B: update of A's card affects 0 rows", async () => {
  const { data, error } = await b.client
    .from("flashcards")
    .update({ translation: "hacked" })
    .eq("id", aCardId)
    .select();
  if (error) return [false, error.message];
  return [data.length === 0, `${data.length} row(s)`];
});

await step("B: delete of A's card affects 0 rows", async () => {
  const { data, error } = await b.client.from("flashcards").delete().eq("id", aCardId).select();
  if (error) return [false, error.message];
  return [data.length === 0, `${data.length} row(s)`];
});

await step("A: card still intact after B's attempts", async () => {
  const { data, error } = await a.client.from("flashcards").select("translation").eq("id", aCardId);
  if (error) return [false, error.message];
  return [data.length === 1 && data[0].translation === "poddać się", JSON.stringify(data)];
});

await step("B: save 'give up' creates B's own card (keys are per user)", async () => {
  const { data, error } = await save(b.client, "give up", "rezygnować", ["B tag"]);
  if (error) return [false, error.message];
  const row = firstRow(data);
  bCardId = row?.flashcard_id;
  const tags = await b.client.from("tags").select("id");
  if (tags.error) return [false, tags.error.message];
  bTagId = tags.data[0]?.id;
  return [row?.created === true && Boolean(bCardId) && bCardId !== aCardId && Boolean(bTagId), JSON.stringify(row)];
});

await step("B: link A's card to B's tag is rejected", async () => {
  const { error } = await b.client.from("flashcard_tags").insert({ flashcard_id: aCardId, tag_id: bTagId });
  return [Boolean(error), error ? error.message : "insert succeeded"];
});

await step("B: link B's card to A's tag is rejected", async () => {
  const { error } = await b.client.from("flashcard_tags").insert({ flashcard_id: bCardId, tag_id: aTagIds[0] });
  return [Boolean(error), error ? error.message : "insert succeeded"];
});

await step("anon: select on all tables returns no rows", async () => {
  const seen = [];
  for (const table of TABLES) {
    const { data } = await anon.from(table).select("*");
    if (data?.length) seen.push(`${table}=${data.length}`);
  }
  return [seen.length === 0, seen.join(",")];
});

await step("anon: save_flashcard is rejected", async () => {
  const { error } = await save(anon, "anon word", "anon", []);
  return [Boolean(error), error ? error.message : "call succeeded"];
});

await step("A: deleting the card removes its links and keeps the tags", async () => {
  const del = await a.client.from("flashcards").delete().eq("id", aCardId).select();
  if (del.error) return [false, del.error.message];
  const links = await a.client.from("flashcard_tags").select("tag_id").eq("flashcard_id", aCardId);
  if (links.error) return [false, links.error.message];
  const tags = await a.client.from("tags").select("id");
  if (tags.error) return [false, tags.error.message];
  return [
    del.data.length === 1 && links.data.length === 0 && tags.data.length === 2,
    `deleted=${del.data.length} links=${links.data.length} tags=${tags.data.length}`,
  ];
});

// ---------------------------------------------------------------------------
// accept_proposal_set and proposal_outcomes
// ---------------------------------------------------------------------------

let aSetOutcomeIds = [];

await step(
  "A: accept a set (2 accepted, 1 rejected) returns (2, 0, 1) with 2 tagged cards and 3 outcomes",
  async () => {
    const { data, error } = await acceptSet(a.client, "Set lesson", [
      acceptItem("set word one", "accepted_unchanged"),
      acceptItem("set word two", "accepted_corrected"),
      acceptItem("set word three", "rejected_known"),
    ]);
    if (error) return [false, error.message];
    const row = firstRow(data);
    const cards = await a.client
      .from("flashcards")
      .select("id, word")
      .in("word", ["set word one", "set word two", "set word three"]);
    if (cards.error) return [false, cards.error.message];
    const tagNames = await Promise.all(cards.data.map((c) => cardTagNames(a.client, c.id)));
    const outcomes = await a.client
      .from("proposal_outcomes")
      .select("id, set_id, outcome")
      .eq("tag_name", "Set lesson");
    if (outcomes.error) return [false, outcomes.error.message];
    aSetOutcomeIds = outcomes.data.map((o) => o.id);
    const ok =
      row?.created_count === 2 &&
      row.merged_count === 0 &&
      row.rejected_count === 1 &&
      cards.data.length === 2 &&
      tagNames.every((names) => names.join("|") === "Set lesson") &&
      outcomes.data.length === 3 &&
      new Set(outcomes.data.map((o) => o.set_id)).size === 1;
    return [ok, `${JSON.stringify(row)} cards=${cards.data.length} outcomes=${outcomes.data.length}`];
  },
);

await step("A: accept a set with an existing word merges it and keeps its translation", async () => {
  const { data, error } = await acceptSet(a.client, "Merge lesson", [
    acceptItem("Set  Word One", "accepted_unchanged", "inna treść"),
  ]);
  if (error) return [false, error.message];
  const row = firstRow(data);
  const card = await a.client.from("flashcards").select("id, translation").eq("word", "set word one").single();
  if (card.error) return [false, card.error.message];
  const names = await cardTagNames(a.client, card.data.id);
  const outcome = await a.client.from("proposal_outcomes").select("merged").eq("tag_name", "Merge lesson");
  if (outcome.error) return [false, outcome.error.message];
  const ok =
    row?.created_count === 0 &&
    row.merged_count === 1 &&
    row.rejected_count === 0 &&
    card.data.translation === "tłumaczenie set word one" &&
    names.join("|") === "Merge lesson|Set lesson" &&
    outcome.data.length === 1 &&
    outcome.data[0].merged === true;
  return [ok, `${JSON.stringify(row)} translation=${card.data.translation} outcome=${JSON.stringify(outcome.data)}`];
});

await step("A: an all-rejected set creates no card and no tag", async () => {
  const before = await writeCounts(a.client);
  const { data, error } = await acceptSet(a.client, "Rejected lesson", [
    acceptItem("rejected word one", "rejected_wrong"),
    acceptItem("rejected word two", "rejected_too_easy"),
  ]);
  if (error) return [false, error.message];
  const row = firstRow(data);
  const after = await writeCounts(a.client);
  const ok =
    row?.created_count === 0 &&
    row.merged_count === 0 &&
    row.rejected_count === 2 &&
    after.flashcards === before.flashcards &&
    after.tags === before.tags &&
    after.flashcard_tags === before.flashcard_tags &&
    after.proposal_outcomes === before.proposal_outcomes + 2;
  return [ok, `${JSON.stringify(row)} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`];
});

await step("B: select on proposal_outcomes returns no rows of A", async () => {
  const all = await b.client.from("proposal_outcomes").select("id, user_id");
  if (all.error) return [false, all.error.message];
  const byId = await b.client.from("proposal_outcomes").select("id").in("id", aSetOutcomeIds);
  if (byId.error) return [false, byId.error.message];
  const leaked = all.data.filter((r) => r.user_id === a.userId).length + byId.data.length;
  return [aSetOutcomeIds.length === 3 && leaked === 0, `${leaked} row(s) of A visible`];
});

await step("A: update and delete of own outcome rows affect 0 rows (append-only)", async () => {
  const upd = await a.client
    .from("proposal_outcomes")
    .update({ outcome: "rejected_wrong" })
    .in("id", aSetOutcomeIds)
    .select();
  if (upd.error) return [false, upd.error.message];
  const del = await a.client.from("proposal_outcomes").delete().in("id", aSetOutcomeIds).select();
  if (del.error) return [false, del.error.message];
  const still = await a.client.from("proposal_outcomes").select("outcome").in("id", aSetOutcomeIds);
  if (still.error) return [false, still.error.message];
  const ok =
    upd.data.length === 0 &&
    del.data.length === 0 &&
    still.data.length === 3 &&
    !still.data.every((r) => r.outcome === "rejected_wrong");
  return [ok, `updated=${upd.data.length} deleted=${del.data.length} remaining=${still.data.length}`];
});

await step("anon: accept_proposal_set is rejected", async () => {
  const { error } = await acceptSet(anon, "Anon lesson", [acceptItem("anon word", "accepted_unchanged")]);
  return [Boolean(error), error ? error.message : "call succeeded"];
});

// Each invalid call must fail as a whole: the counts of every written table stay the same.
async function rejectedWithoutWrites(tagName, items) {
  const before = await writeCounts(a.client);
  const { error } = await acceptSet(a.client, tagName, items);
  const after = await writeCounts(a.client);
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  return [
    error !== null && unchanged,
    `${error?.message ?? "accepted"} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
  ];
}

await step("A: a set of 151 items is rejected and nothing is written", async () =>
  rejectedWithoutWrites(
    "Too many lesson",
    Array.from({ length: 151 }, (_, i) => acceptItem(`limit word ${String(i)}`, "accepted_unchanged")),
  ),
);

await step("A: a blank tag name is rejected and nothing is written", async () =>
  rejectedWithoutWrites("\t \n", [acceptItem("blank tag word", "accepted_unchanged")]),
);

await step("A: an unknown outcome after a valid item rolls the whole set back", async () =>
  rejectedWithoutWrites("Rollback lesson", [
    acceptItem("rollback word", "accepted_unchanged"),
    acceptItem("bogus word", "accepted_maybe"),
  ]),
);

finish();
