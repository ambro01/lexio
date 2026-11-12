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

// Without a source the call is the three-argument lesson call older code makes (p_source defaults to 'lesson').
async function acceptSet(client, tagName, items, source) {
  return client.rpc("accept_proposal_set", {
    p_tag_name: tagName,
    p_model: "check-rls",
    p_items: items,
    ...(source === undefined ? {} : { p_source: source }),
  });
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
async function rejectedWithoutWrites(tagName, items, source) {
  const before = await writeCounts(a.client);
  const { error } = await acceptSet(a.client, tagName, items, source);
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

// ---------------------------------------------------------------------------
// accept_proposal_set sources (S-04): manual saves are 1 item with an optional tag; lesson saves are unchanged.
// ---------------------------------------------------------------------------

async function cardByWord(client, word) {
  const card = await client.from("flashcards").select("id").eq("word", word).maybeSingle();
  if (card.error) throw new Error(card.error.message);
  return card.data;
}

async function outcomesOfWord(client, word) {
  const outcomes = await client.from("proposal_outcomes").select("outcome, tag_name, source").eq("word", word);
  if (outcomes.error) throw new Error(outcomes.error.message);
  return outcomes.data;
}

await step("A: a manual save with no tag creates 1 untagged card and 1 'manual' outcome with no tag", async () => {
  const { data, error } = await acceptSet(a.client, null, [acceptItem("manual word", "accepted_unchanged")], "manual");
  if (error) return [false, error.message];
  const row = firstRow(data);
  const card = await cardByWord(a.client, "manual word");
  const names = card ? await cardTagNames(a.client, card.id) : ["<no card>"];
  const outcomes = await outcomesOfWord(a.client, "manual word");
  const ok =
    row?.created_count === 1 &&
    row.merged_count === 0 &&
    row.rejected_count === 0 &&
    names.length === 0 &&
    outcomes.length === 1 &&
    outcomes[0].source === "manual" &&
    outcomes[0].tag_name === null &&
    outcomes[0].outcome === "accepted_unchanged";
  return [ok, `${JSON.stringify(row)} tags=${names.join(",")} outcomes=${JSON.stringify(outcomes)}`];
});

await step("A: a manual save with a blank tag also saves without a tag", async () => {
  const { error } = await acceptSet(a.client, " \t ", [acceptItem("manual blank", "accepted_corrected")], "manual");
  if (error) return [false, error.message];
  const card = await cardByWord(a.client, "manual blank");
  const names = card ? await cardTagNames(a.client, card.id) : ["<no card>"];
  const outcomes = await outcomesOfWord(a.client, "manual blank");
  const ok = names.length === 0 && outcomes.length === 1 && outcomes[0].tag_name === null;
  return [ok, `tags=${names.join(",")} outcomes=${JSON.stringify(outcomes)}`];
});

await step("A: a manual save with a tag tags the card", async () => {
  const { error } = await acceptSet(
    a.client,
    "Manual tag",
    [acceptItem("manual tagged", "accepted_unchanged")],
    "manual",
  );
  if (error) return [false, error.message];
  const card = await cardByWord(a.client, "manual tagged");
  const names = card ? await cardTagNames(a.client, card.id) : ["<no card>"];
  const outcomes = await outcomesOfWord(a.client, "manual tagged");
  const ok =
    names.join("|") === "Manual tag" &&
    outcomes.length === 1 &&
    outcomes[0].source === "manual" &&
    outcomes[0].tag_name === "Manual tag";
  return [ok, `tags=${names.join(",")} outcomes=${JSON.stringify(outcomes)}`];
});

await step("A: a manual save with 2 items is rejected and nothing is written", async () =>
  rejectedWithoutWrites(
    "Manual two",
    [acceptItem("manual two a", "accepted_unchanged"), acceptItem("manual two b", "accepted_unchanged")],
    "manual",
  ),
);

await step("A: a lesson save without p_source still works and records source = 'lesson'", async () => {
  const { error } = await acceptSet(a.client, "Default source lesson", [
    acceptItem("default source one", "accepted_unchanged"),
    acceptItem("default source two", "rejected_wrong"),
  ]);
  if (error) return [false, error.message];
  const outcomes = await a.client.from("proposal_outcomes").select("source").eq("tag_name", "Default source lesson");
  if (outcomes.error) return [false, outcomes.error.message];
  const ok = outcomes.data.length === 2 && outcomes.data.every((o) => o.source === "lesson");
  return [ok, JSON.stringify(outcomes.data)];
});

await step("A: a lesson save with source 'lesson' and a blank tag is still rejected and nothing is written", async () =>
  rejectedWithoutWrites(" ", [acceptItem("lesson blank tag", "accepted_unchanged")], "lesson"),
);

await step("A: an unknown source is rejected and nothing is written", async () =>
  rejectedWithoutWrites("Import lesson", [acceptItem("unknown source word", "accepted_unchanged")], "import"),
);

// ---------------------------------------------------------------------------
// profiles: one settings row per user, written the way profiles.service.ts does (upsert on user_id,
// which defaults to auth.uid()).
// ---------------------------------------------------------------------------

const PROFILE_MODEL = "openai/gpt-6-luna";

async function upsertProfile(client, profile) {
  return client.from("profiles").upsert(profile, { onConflict: "user_id" }).select("user_id, cefr_level, ai_model");
}

await step("A: has no profile row at first", async () => {
  const { data, error } = await a.client.from("profiles").select("user_id");
  if (error) return [false, error.message];
  return [data.length === 0, `${data.length} row(s)`];
});

await step("A: upsert a profile twice (insert, then update) and read it back", async () => {
  const first = await upsertProfile(a.client, { cefr_level: "A2", ai_model: null });
  if (first.error) return [false, first.error.message];
  const second = await upsertProfile(a.client, { cefr_level: "B1", ai_model: PROFILE_MODEL });
  if (second.error) return [false, second.error.message];
  const { data, error } = await a.client.from("profiles").select("user_id, cefr_level, ai_model");
  if (error) return [false, error.message];
  const ok =
    data.length === 1 &&
    data[0].user_id === a.userId &&
    data[0].cefr_level === "B1" &&
    data[0].ai_model === PROFILE_MODEL;
  return [ok, JSON.stringify(data)];
});

await step("B: select on profiles returns no rows of A", async () => {
  const all = await b.client.from("profiles").select("user_id");
  if (all.error) return [false, all.error.message];
  const byId = await b.client.from("profiles").select("user_id").eq("user_id", a.userId);
  if (byId.error) return [false, byId.error.message];
  const leaked = all.data.filter((r) => r.user_id === a.userId).length + byId.data.length;
  return [leaked === 0, `${leaked} row(s) of A visible`];
});

await step("B: update of A's profile affects 0 rows", async () => {
  const { data, error } = await b.client.from("profiles").update({ cefr_level: "C2" }).eq("user_id", a.userId).select();
  if (error) return [false, error.message];
  return [data.length === 0, `${data.length} row(s)`];
});

await step("B: insert of a profile with A's user_id is rejected", async () => {
  const { error } = await b.client.from("profiles").insert({ user_id: a.userId, cefr_level: "C2" });
  return [Boolean(error), error ? error.message : "insert succeeded"];
});

await step("B: upsert of a profile with A's user_id is rejected (the service's write path)", async () => {
  const { data, error } = await b.client
    .from("profiles")
    .upsert({ user_id: a.userId, cefr_level: "C2" }, { onConflict: "user_id" })
    .select("user_id");
  return [Boolean(error) || data.length === 0, error ? error.message : `${data.length} row(s)`];
});

await step("anon: insert into profiles is rejected", async () => {
  const { error } = await anon.from("profiles").insert({ user_id: a.userId, cefr_level: "C2" });
  return [Boolean(error), error ? error.message : "insert succeeded"];
});

await step("A: profile still intact after B's attempts", async () => {
  const { data, error } = await a.client.from("profiles").select("cefr_level, ai_model");
  if (error) return [false, error.message];
  return [data.length === 1 && data[0].cefr_level === "B1" && data[0].ai_model === PROFILE_MODEL, JSON.stringify(data)];
});

await step("A: updated_at is kept by the database (a client-sent value is overwritten on update)", async () => {
  const sent = "2000-01-01T00:00:00Z";
  const { data, error } = await a.client
    .from("profiles")
    .update({ updated_at: sent })
    .eq("user_id", a.userId)
    .select("updated_at");
  if (error) return [false, error.message];
  const stored = data[0]?.updated_at;
  return [data.length === 1 && new Date(stored).getFullYear() > 2000, `updated_at ${String(stored)}`];
});

await step("A: an invalid cefr_level ('D1') is rejected", async () => {
  const { error } = await upsertProfile(a.client, { cefr_level: "D1", ai_model: null });
  return [Boolean(error), error ? error.message : "upsert succeeded"];
});

await step("anon: select on profiles returns no rows", async () => {
  const { data } = await anon.from("profiles").select("*");
  return [!data?.length, data?.length ? `${data.length} row(s)` : ""];
});

// ---------------------------------------------------------------------------
// collection (S-05): add_flashcard_tag, link removal, edit/delete isolation and the paging order.
// ---------------------------------------------------------------------------

async function addTag(client, cardId, tagName) {
  return client.rpc("add_flashcard_tag", { p_flashcard_id: cardId, p_tag_name: tagName });
}

async function tagIdByName(client, name) {
  const { data, error } = await client.from("tags").select("id").eq("name", name).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id;
}

let collCardId;
let collOtherId;
let collNewTagId;
let collReuseTagId;

await step("A: setup — save two cards for the collection checks", async () => {
  const first = await save(a.client, "collection word", "słowo kolekcji", []);
  if (first.error) return [false, first.error.message];
  const second = await save(a.client, "collection other", "inne słowo", ["Coll reuse"]);
  if (second.error) return [false, second.error.message];
  collCardId = firstRow(first.data)?.flashcard_id;
  collOtherId = firstRow(second.data)?.flashcard_id;
  collReuseTagId = await tagIdByName(a.client, "Coll reuse");
  return [Boolean(collCardId && collOtherId && collReuseTagId), `card=${collCardId} other=${collOtherId}`];
});

await step("A: add_flashcard_tag with a new name creates one tag and one link (linked = true)", async () => {
  const before = await writeCounts(a.client);
  const { data, error } = await addTag(a.client, collCardId, "Coll New");
  if (error) return [false, error.message];
  const row = firstRow(data);
  collNewTagId = row?.tag_id;
  const after = await writeCounts(a.client);
  const names = await cardTagNames(a.client, collCardId);
  const ok =
    row?.linked === true &&
    row.tag_name === "Coll New" &&
    Boolean(collNewTagId) &&
    after.tags === before.tags + 1 &&
    after.flashcard_tags === before.flashcard_tags + 1 &&
    names.join("|") === "Coll New";
  return [ok, `${JSON.stringify(row)} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`];
});

await step(
  "A: repeating it with different case/spacing returns the same tag, linked = false, no new rows",
  async () => {
    const before = await writeCounts(a.client);
    const { data, error } = await addTag(a.client, collCardId, "  coll \t NEW ");
    if (error) return [false, error.message];
    const row = firstRow(data);
    const after = await writeCounts(a.client);
    const ok =
      row?.tag_id === collNewTagId &&
      row.linked === false &&
      row.tag_name === "Coll New" &&
      JSON.stringify(before) === JSON.stringify(after);
    return [ok, `${JSON.stringify(row)} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`];
  },
);

await step("A: adding an existing tag name (from save) reuses that tag", async () => {
  const before = await writeCounts(a.client);
  const { data, error } = await addTag(a.client, collCardId, "COLL REUSE");
  if (error) return [false, error.message];
  const row = firstRow(data);
  const after = await writeCounts(a.client);
  const ok =
    row?.tag_id === collReuseTagId &&
    row.linked === true &&
    row.tag_name === "Coll reuse" &&
    after.tags === before.tags &&
    after.flashcard_tags === before.flashcard_tags + 1;
  return [ok, `${JSON.stringify(row)} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`];
});

await step("A: a blank tag name is rejected (22023)", async () => {
  const { error } = await addTag(a.client, collCardId, " \t\n ");
  return [error?.code === "22023", error ? `${error.code} ${error.message}` : "accepted"];
});

await step("B: add_flashcard_tag on A's card fails with P0002 and writes nothing", async () => {
  const beforeA = await writeCounts(a.client);
  const beforeB = await writeCounts(b.client);
  const { error } = await addTag(b.client, collCardId, "B intruder tag");
  const afterA = await writeCounts(a.client);
  const afterB = await writeCounts(b.client);
  const names = await cardTagNames(a.client, collCardId);
  const ok =
    error?.code === "P0002" &&
    JSON.stringify(beforeA) === JSON.stringify(afterA) &&
    JSON.stringify(beforeB) === JSON.stringify(afterB) &&
    names.join("|") === "Coll New|Coll reuse";
  return [ok, `${error ? `${error.code} ${error.message}` : "call succeeded"} tags=${names.join(",")}`];
});

await step("anon: add_flashcard_tag is rejected", async () => {
  const { error } = await addTag(anon, collCardId, "Anon tag");
  return [Boolean(error), error ? `${error.code} ${error.message}` : "call succeeded"];
});

await step("A: a 21st tag on one card fails with 54000 and the would-be new tag does not exist", async () => {
  const save20 = await save(a.client, "collection limit", "limit", []);
  if (save20.error) return [false, save20.error.message];
  const limitCardId = firstRow(save20.data)?.flashcard_id;
  for (let i = 1; i <= 20; i++) {
    const { error } = await addTag(a.client, limitCardId, `Coll limit ${String(i)}`);
    if (error) return [false, `tag ${String(i)}: ${error.message}`];
  }
  const before = await writeCounts(a.client);
  const { error } = await addTag(a.client, limitCardId, "Coll overflow");
  const after = await writeCounts(a.client);
  const overflow = await tagIdByName(a.client, "Coll overflow");
  const again = await addTag(a.client, limitCardId, "coll limit 1");
  const ok =
    error?.code === "54000" &&
    overflow === undefined &&
    JSON.stringify(before) === JSON.stringify(after) &&
    again.error === null &&
    firstRow(again.data)?.linked === false;
  return [
    ok,
    `${error ? `${error.code} ${error.message}` : "accepted"} overflowTag=${String(overflow)} relink=${JSON.stringify(again.data ?? again.error)}`,
  ];
});

await step("B: delete of A's tag link affects 0 rows", async () => {
  const { data, error } = await b.client
    .from("flashcard_tags")
    .delete()
    .eq("flashcard_id", collCardId)
    .eq("tag_id", collReuseTagId)
    .select();
  if (error) return [false, error.message];
  const names = await cardTagNames(a.client, collCardId);
  return [data.length === 0 && names.includes("Coll reuse"), `${data.length} row(s) tags=${names.join(",")}`];
});

await step("A: deleting a tag link keeps the tag; deleting it again affects 0 rows", async () => {
  const del = await a.client
    .from("flashcard_tags")
    .delete()
    .eq("flashcard_id", collCardId)
    .eq("tag_id", collNewTagId)
    .select();
  if (del.error) return [false, del.error.message];
  const again = await a.client
    .from("flashcard_tags")
    .delete()
    .eq("flashcard_id", collCardId)
    .eq("tag_id", collNewTagId)
    .select();
  if (again.error) return [false, again.error.message];
  const tagStill = await tagIdByName(a.client, "Coll New");
  const names = await cardTagNames(a.client, collCardId);
  const ok =
    del.data.length === 1 && again.data.length === 0 && tagStill === collNewTagId && names.join("|") === "Coll reuse";
  return [ok, `deleted=${del.data.length} again=${again.data.length} tags=${names.join(",")}`];
});

await step("B: update and delete of A's collection card affect 0 rows", async () => {
  const upd = await b.client.from("flashcards").update({ translation: "hacked" }).eq("id", collCardId).select();
  if (upd.error) return [false, upd.error.message];
  const del = await b.client.from("flashcards").delete().eq("id", collCardId).select();
  if (del.error) return [false, del.error.message];
  const card = await a.client.from("flashcards").select("translation").eq("id", collCardId);
  if (card.error) return [false, card.error.message];
  const ok =
    upd.data.length === 0 &&
    del.data.length === 0 &&
    card.data.length === 1 &&
    card.data[0].translation === "słowo kolekcji";
  return [ok, `updated=${upd.data.length} deleted=${del.data.length} card=${JSON.stringify(card.data)}`];
});

await step("A: renaming a card to another of A's words fails with 23505", async () => {
  const { error } = await a.client
    .from("flashcards")
    .update({ word: "Collection  Other" })
    .eq("id", collCardId)
    .select();
  const other = await a.client.from("flashcards").select("word").eq("id", collOtherId).single();
  if (other.error) return [false, other.error.message];
  return [
    error?.code === "23505" && other.data.word === "collection other",
    error ? `${error.code} ${error.message}` : "update succeeded",
  ];
});

await step("A: cards from one accept_proposal_set call share created_at and page in id order, each once", async () => {
  const words = ["paging cherry", "paging apple", "paging banana"];
  const { error } = await acceptSet(
    a.client,
    "Paging lesson",
    words.map((word) => acceptItem(word, "accepted_unchanged")),
  );
  if (error) return [false, error.message];
  const { data, error: listError } = await a.client
    .from("flashcards")
    .select("id, word_key, created_at")
    .in("word", words)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(0, 1);
  if (listError) return [false, listError.message];
  const rest = await a.client
    .from("flashcards")
    .select("id, word_key, created_at")
    .in("word", words)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(2, 3);
  if (rest.error) return [false, rest.error.message];
  const all = [...data, ...rest.data];
  const ids = all.map((r) => r.id);
  const ok =
    [...all.map((r) => r.word_key)].sort().join("|") === "paging apple|paging banana|paging cherry" &&
    ids.every((id, i) => i === 0 || ids[i - 1] < id) &&
    new Set(all.map((r) => r.created_at)).size === 1;
  return [ok, JSON.stringify(all)];
});

finish();
