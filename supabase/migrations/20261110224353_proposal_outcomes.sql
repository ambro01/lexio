-- Proposal outcomes (S-01): one row per reviewed AI proposal, so the content-quality rate (S-07)
-- and the known-words filter (S-09) can be computed later — these records cannot be reconstructed.
-- accept_proposal_set saves a whole reviewed set (cards via save_flashcard + outcome rows) in one
-- transaction. Additive: a new table and a new function, nothing existing changes.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.proposal_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id uuid not null,
  word text not null,
  -- Same rule as flashcards.word_key, so S-09 can match outcomes against cards.
  word_key text generated always as (lower(btrim(regexp_replace(word, '\s+', ' ', 'g')))) stored,
  outcome text not null check (
    outcome in ('accepted_unchanged', 'accepted_corrected', 'rejected_wrong', 'rejected_known', 'rejected_too_easy')
  ),
  merged boolean not null default false,
  model text null,
  tag_name text null,
  created_at timestamptz not null default now(),
  constraint proposal_outcomes_word_length
    check (char_length(btrim(regexp_replace(word, '\s+', ' ', 'g'))) between 1 and 100),
  constraint proposal_outcomes_model_length check (char_length(model) <= 100),
  constraint proposal_outcomes_tag_name_length check (char_length(tag_name) <= 50)
);

-- S-09 lookup: "has this user already rejected/accepted this word?"
create index proposal_outcomes_user_word_key_idx on public.proposal_outcomes (user_id, word_key);

-- ---------------------------------------------------------------------------
-- Row level security: authenticated users see and add only their own rows; anon gets nothing.
-- Outcome records are append-only: no update or delete policies.
-- ---------------------------------------------------------------------------

alter table public.proposal_outcomes enable row level security;

create policy "proposal_outcomes_select_own" on public.proposal_outcomes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "proposal_outcomes_insert_own" on public.proposal_outcomes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- accept_proposal_set: save every accepted proposal with the lesson tag and record the outcome of
-- every proposal — all or nothing. security invoker, so RLS applies here and inside save_flashcard.
-- The caller classifies outcomes and decides the recorded word (AI original for rejected items,
-- final word for accepted ones). Items are saved one by one, never in parallel.
-- p_items: [{ "word", "translation", "additionalMeanings": string[], "exampleSentence",
--             "cefr": string | null, "outcome" }], 1–150 items.
-- ---------------------------------------------------------------------------

create function public.accept_proposal_set(
  p_tag_name text,
  p_model text,
  p_items jsonb
)
returns table (created_count int, merged_count int, rejected_count int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_set_id uuid := gen_random_uuid();
  v_tag_name text := btrim(regexp_replace(p_tag_name, '\s+', ' ', 'g'));
  v_item jsonb;
  v_outcome text;
  v_created boolean;
  v_created_count int := 0;
  v_merged_count int := 0;
  v_rejected_count int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 150 then
    raise exception 'accept_proposal_set: items must be an array of 1-150 items' using errcode = '22023';
  end if;

  if v_tag_name is null or v_tag_name = '' then
    raise exception 'accept_proposal_set: tag name must not be blank' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'accept_proposal_set: every item must be an object' using errcode = '22023';
    end if;

    v_outcome := v_item->>'outcome';
    if v_outcome is null or v_outcome not in (
      'accepted_unchanged', 'accepted_corrected', 'rejected_wrong', 'rejected_known', 'rejected_too_easy'
    ) then
      raise exception 'accept_proposal_set: unknown outcome' using errcode = '22023';
    end if;

    if v_outcome like 'accepted\_%' then
      select s.created into v_created
      from public.save_flashcard(
        v_item->>'word',
        v_item->>'translation',
        array(select jsonb_array_elements_text(coalesce(v_item->'additionalMeanings', '[]'::jsonb))),
        v_item->>'exampleSentence',
        v_item->>'cefr',
        array[v_tag_name]
      ) s;

      if v_created then
        v_created_count := v_created_count + 1;
      else
        v_merged_count := v_merged_count + 1;
      end if;
    else
      v_created := true;
      v_rejected_count := v_rejected_count + 1;
    end if;

    insert into public.proposal_outcomes (set_id, word, outcome, merged, model, tag_name)
    values (
      v_set_id,
      btrim(regexp_replace(v_item->>'word', '\s+', ' ', 'g')),
      v_outcome,
      not v_created,
      p_model,
      v_tag_name
    );
  end loop;

  return query select v_created_count, v_merged_count, v_rejected_count;
end;
$$;

revoke execute on function public.accept_proposal_set(text, text, jsonb) from public, anon;
grant execute on function public.accept_proposal_set(text, text, jsonb) to authenticated;
