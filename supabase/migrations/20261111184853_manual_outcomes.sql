-- Manual outcomes (S-04): mark where a proposal outcome came from, and let accept_proposal_set save a single
-- manually added card (AI word fill) with or without a tag, through the one accept path.
-- Additive: proposal_outcomes gains a source column with a default (existing rows become 'lesson').
-- accept_proposal_set is dropped and recreated with a fourth parameter p_source defaulting to 'lesson', so the
-- existing three-argument lesson calls keep working unchanged (old code against the new function).

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------

alter table public.proposal_outcomes
  add column source text not null default 'lesson' check (source in ('lesson', 'manual'));

-- ---------------------------------------------------------------------------
-- accept_proposal_set: as in 20261110224353_proposal_outcomes.sql, plus p_source.
-- 'lesson': non-blank tag required, 1–150 items (unchanged).
-- 'manual': exactly 1 item; a null or blank tag means no tag (the card is saved without tags and the outcome
--           row stores tag_name = null).
-- Every outcome row stores source = p_source. Any other source → 22023.
-- ---------------------------------------------------------------------------

drop function public.accept_proposal_set(text, text, jsonb);

create function public.accept_proposal_set(
  p_tag_name text,
  p_model text,
  p_items jsonb,
  p_source text default 'lesson'
)
returns table (created_count int, merged_count int, rejected_count int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_set_id uuid := gen_random_uuid();
  v_tag_name text := nullif(btrim(regexp_replace(p_tag_name, '\s+', ' ', 'g')), '');
  v_tag_names text[];
  v_item jsonb;
  v_outcome text;
  v_created boolean;
  v_created_count int := 0;
  v_merged_count int := 0;
  v_rejected_count int := 0;
begin
  if p_source is null or p_source not in ('lesson', 'manual') then
    raise exception 'accept_proposal_set: unknown source' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 150 then
    raise exception 'accept_proposal_set: items must be an array of 1-150 items' using errcode = '22023';
  end if;

  if p_source = 'manual' and jsonb_array_length(p_items) <> 1 then
    raise exception 'accept_proposal_set: a manual save must have exactly 1 item' using errcode = '22023';
  end if;

  if p_source = 'lesson' and v_tag_name is null then
    raise exception 'accept_proposal_set: tag name must not be blank' using errcode = '22023';
  end if;

  v_tag_names := case when v_tag_name is null then '{}'::text[] else array[v_tag_name] end;

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
        v_tag_names
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

    insert into public.proposal_outcomes (set_id, word, outcome, merged, model, tag_name, source)
    values (
      v_set_id,
      btrim(regexp_replace(v_item->>'word', '\s+', ' ', 'g')),
      v_outcome,
      not v_created,
      p_model,
      v_tag_name,
      p_source
    );
  end loop;

  return query select v_created_count, v_merged_count, v_rejected_count;
end;
$$;

revoke execute on function public.accept_proposal_set(text, text, jsonb, text) from public, anon;
grant execute on function public.accept_proposal_set(text, text, jsonb, text) to authenticated;
