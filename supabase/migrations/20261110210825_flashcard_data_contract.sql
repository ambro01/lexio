-- Flashcard data contract (F-02): per-user flashcards, tags and their links.
-- Uniqueness ("one word = one card", "one tag name = one tag") and isolation between users
-- are enforced by Postgres itself: generated keys + unique constraints, composite ownership
-- foreign keys and per-operation RLS policies for the authenticated role.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word text not null,
  word_key text generated always as (lower(regexp_replace(btrim(word), '\s+', ' ', 'g'))) stored,
  translation text not null,
  additional_meanings text[] not null default '{}',
  example_sentence text not null default '',
  cefr text null check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcards_word_length check (char_length(btrim(word)) between 1 and 100),
  constraint flashcards_translation_not_blank check (char_length(btrim(translation)) >= 1),
  constraint flashcards_user_word_key_unique unique (user_id, word_key),
  constraint flashcards_id_user_unique unique (id, user_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  name_key text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  constraint tags_name_length check (char_length(btrim(name)) between 1 and 50),
  constraint tags_user_name_key_unique unique (user_id, name_key),
  constraint tags_id_user_unique unique (id, user_id)
);

-- Composite foreign keys make a link between one user's card and another user's tag impossible.
create table public.flashcard_tags (
  flashcard_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (flashcard_id, tag_id),
  constraint flashcard_tags_flashcard_fk foreign key (flashcard_id, user_id)
    references public.flashcards (id, user_id) on delete cascade,
  constraint flashcard_tags_tag_fk foreign key (tag_id, user_id)
    references public.tags (id, user_id) on delete cascade
);

-- Review-by-tag lookups and the tag-side cascade.
create index flashcard_tags_tag_id_idx on public.flashcard_tags (tag_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger flashcards_set_updated_at
before update on public.flashcards
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: authenticated users see and change only their own rows; anon gets nothing.
-- ---------------------------------------------------------------------------

alter table public.flashcards enable row level security;
alter table public.tags enable row level security;
alter table public.flashcard_tags enable row level security;

create policy "flashcards_select_own" on public.flashcards
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "flashcards_insert_own" on public.flashcards
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "flashcards_update_own" on public.flashcards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "flashcards_delete_own" on public.flashcards
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "tags_select_own" on public.tags
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "tags_insert_own" on public.tags
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "tags_update_own" on public.tags
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "tags_delete_own" on public.tags
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Links are only inserted and deleted, never updated.
create policy "flashcard_tags_select_own" on public.flashcard_tags
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "flashcard_tags_insert_own" on public.flashcard_tags
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "flashcard_tags_delete_own" on public.flashcard_tags
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- save_flashcard: create a card (or find the existing one for the same word) and attach tags.
-- security invoker, so RLS applies to every statement below. Concurrent saves of the same word
-- rely on insert ... on conflict do nothing followed by a select, never check-then-insert.
-- An existing card's content is left untouched (created = false).
-- ---------------------------------------------------------------------------

create function public.save_flashcard(
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
  v_card_id uuid;
  v_created boolean := false;
  v_tag_name text;
  v_tag_key text;
  v_tag_id uuid;
begin
  insert into public.flashcards (word, translation, additional_meanings, example_sentence, cefr)
  values (
    btrim(p_word),
    btrim(p_translation),
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
      and f.word_key = lower(regexp_replace(btrim(p_word), '\s+', ' ', 'g'));

    if v_card_id is null then
      raise exception 'save_flashcard: card for word % not found after conflict', p_word;
    end if;
  end if;

  foreach v_tag_name in array coalesce(p_tag_names, '{}') loop
    continue when v_tag_name is null or btrim(v_tag_name) = '';

    insert into public.tags (name)
    values (btrim(v_tag_name))
    on conflict (user_id, name_key) do nothing;

    v_tag_key := lower(regexp_replace(btrim(v_tag_name), '\s+', ' ', 'g'));

    select t.id into v_tag_id
    from public.tags t
    where t.user_id = v_user_id
      and t.name_key = v_tag_key;

    insert into public.flashcard_tags (flashcard_id, tag_id)
    values (v_card_id, v_tag_id)
    on conflict do nothing;
  end loop;

  return query select v_card_id, v_created;
end;
$$;

revoke execute on function public.save_flashcard(text, text, text[], text, text, text[]) from public, anon;
grant execute on function public.save_flashcard(text, text, text[], text, text, text[]) to authenticated;
