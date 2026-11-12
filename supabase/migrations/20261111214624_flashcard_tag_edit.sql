-- Collection tag editing (S-05): add one tag to an existing card in one transaction, creating the tag if the
-- user has no tag with that name yet. Additive: one new function, no table or data changes.
-- Removing a tag from a card is a plain delete on public.flashcard_tags under the existing RLS policies.

-- ---------------------------------------------------------------------------
-- add_flashcard_tag
-- Name normalised like save_flashcard (whitespace runs collapsed, trimmed); blank or > 50 chars → 22023.
-- Card not visible to the caller (missing or another user's) → P0002, nothing written.
-- Link already present → linked = false, nothing else written.
-- New link when the card already has 20 links → 54000; the raise rolls back a tag created by this call.
-- The limit is a soft check (count then insert): two concurrent adds may exceed it by one.
-- security invoker, so RLS applies to every statement below.
-- ---------------------------------------------------------------------------

create function public.add_flashcard_tag(
  p_flashcard_id uuid,
  p_tag_name text
)
returns table (tag_id uuid, tag_name text, linked boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(regexp_replace(p_tag_name, '\s+', ' ', 'g'));
  v_tag_id uuid;
  v_tag_name text;
  v_link_count int;
  v_inserted int;
begin
  if v_name is null or v_name = '' or char_length(v_name) > 50 then
    raise exception 'add_flashcard_tag: tag name must be 1-50 characters' using errcode = '22023';
  end if;

  perform 1 from public.flashcards f where f.id = p_flashcard_id;
  if not found then
    raise exception 'add_flashcard_tag: flashcard not found' using errcode = 'P0002';
  end if;

  insert into public.tags (name)
  values (v_name)
  on conflict (user_id, name_key) do nothing;

  select t.id, t.name into v_tag_id, v_tag_name
  from public.tags t
  where t.user_id = v_user_id
    and t.name_key = lower(v_name);

  if v_tag_id is null then
    raise exception 'add_flashcard_tag: tag not found after conflict';
  end if;

  if exists (
    select 1 from public.flashcard_tags ft
    where ft.flashcard_id = p_flashcard_id
      and ft.tag_id = v_tag_id
  ) then
    return query select v_tag_id, v_tag_name, false;
    return;
  end if;

  select count(*) into v_link_count
  from public.flashcard_tags ft
  where ft.flashcard_id = p_flashcard_id;

  if v_link_count >= 20 then
    raise exception 'add_flashcard_tag: at most 20 tags per flashcard' using errcode = '54000';
  end if;

  insert into public.flashcard_tags (flashcard_id, tag_id)
  values (p_flashcard_id, v_tag_id)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  return query select v_tag_id, v_tag_name, v_inserted > 0;
end;
$$;

revoke execute on function public.add_flashcard_tag(uuid, text) from public, anon;
grant execute on function public.add_flashcard_tag(uuid, text) to authenticated;
