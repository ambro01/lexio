-- Follow-up to 20261110210825_flashcard_data_contract (impl-review F1).
-- btrim() without a second argument strips only spaces, so "\tgive up" got the key " give up"
-- (a second card for the same word) and a tab-only word passed the length check.
-- F1 fix: collapse every whitespace run to one space first, then trim — in the generated keys,
-- the length checks and save_flashcard. Additive: no data is dropped.

-- ---------------------------------------------------------------------------
-- Keys and checks
-- ---------------------------------------------------------------------------

alter table public.flashcards
  alter column word_key set expression as (lower(btrim(regexp_replace(word, '\s+', ' ', 'g'))));

alter table public.flashcards
  drop constraint flashcards_word_length,
  add constraint flashcards_word_length
    check (char_length(btrim(regexp_replace(word, '\s+', ' ', 'g'))) between 1 and 100),
  drop constraint flashcards_translation_not_blank,
  add constraint flashcards_translation_not_blank
    check (char_length(btrim(regexp_replace(translation, '\s+', ' ', 'g'))) >= 1);

-- Size limits (impl-review F2): every caller can reach PostgREST directly with the anon key.
alter table public.flashcards
  add constraint flashcards_translation_length check (char_length(translation) <= 500),
  add constraint flashcards_example_sentence_length check (char_length(example_sentence) <= 500),
  add constraint flashcards_additional_meanings_size
    check (cardinality(additional_meanings) <= 10 and char_length(array_to_string(additional_meanings, '|')) <= 2000);

alter table public.tags
  alter column name_key set expression as (lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))));

alter table public.tags
  drop constraint tags_name_length,
  add constraint tags_name_length
    check (char_length(btrim(regexp_replace(name, '\s+', ' ', 'g'))) between 1 and 50);

-- ---------------------------------------------------------------------------
-- save_flashcard: same signature and grants; whitespace is normalised the same way as the keys.
-- ---------------------------------------------------------------------------

create or replace function public.save_flashcard(
  p_word text,
  p_translation text,
  p_additional_meanings text[],
  p_example_sentence text,
  p_cefr text,
  p_tag_names text[]
)
returns table (flashcard_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_word text := btrim(regexp_replace(p_word, '\s+', ' ', 'g'));
  v_card_id uuid;
  v_created boolean := false;
  v_tag_name text;
  v_tag_id uuid;
begin
  if cardinality(p_tag_names) > 20 then
    raise exception 'save_flashcard: at most 20 tags per call' using errcode = '22023';
  end if;

  insert into public.flashcards (word, translation, additional_meanings, example_sentence, cefr)
  values (
    v_word,
    btrim(regexp_replace(p_translation, '\s+', ' ', 'g')),
    coalesce(p_additional_meanings, '{}'),
    coalesce(p_example_sentence, ''),
    p_cefr
  )
  on conflict (user_id, word_key) do nothing
  returning id into v_card_id;

  if v_card_id is not null then
    v_created := true;
  else
    select f.id into v_card_id
    from public.flashcards f
    where f.user_id = v_user_id
      and f.word_key = lower(v_word);

    if v_card_id is null then
      raise exception 'save_flashcard: card not found after conflict';
    end if;
  end if;

  foreach v_tag_name in array coalesce(p_tag_names, '{}') loop
    v_tag_name := btrim(regexp_replace(v_tag_name, '\s+', ' ', 'g'));
    continue when v_tag_name is null or v_tag_name = '';

    insert into public.tags (name)
    values (v_tag_name)
    on conflict (user_id, name_key) do nothing;

    select t.id into v_tag_id
    from public.tags t
    where t.user_id = v_user_id
      and t.name_key = lower(v_tag_name);

    insert into public.flashcard_tags (flashcard_id, tag_id)
    values (v_card_id, v_tag_id)
    on conflict do nothing;
  end loop;

  return query select v_card_id, v_created;
end;
$$;
