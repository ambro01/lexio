-- Spaced review session (S-06): per-card FSRS state, an append-only review log and the RPCs that read the
-- review queue, record one rating and toggle "Opanowane". Additive: two new tables and four new functions.
-- FSRS itself runs in TypeScript (src/lib/review/scheduler.ts); the database stores what it computes.
-- A card is new when it has no review_states row, or its row has state = 0 (a never-reviewed card that was
-- marked "Opanowane" and possibly un-marked again).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per reviewed (or mastered) card. The composite foreign key keeps the state with its owner's card
-- and removes it with the card.
create table public.review_states (
  flashcard_id uuid primary key,
  user_id uuid not null default auth.uid(),
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  scheduled_days integer not null,
  learning_steps integer not null,
  reps integer not null,
  lapses integer not null,
  state smallint not null check (state between 0 and 3),
  last_review timestamptz null,
  mastered_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint review_states_flashcard_fk foreign key (flashcard_id, user_id)
    references public.flashcards (id, user_id) on delete cascade
);

-- The review queue's "due cards first" lookup.
create index review_states_user_id_due_idx on public.review_states (user_id, due);

create trigger review_states_set_updated_at
before update on public.review_states
for each row execute function public.set_updated_at();

-- One row per rating, append-only. Holds the card state the rating produced.
create table public.review_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  flashcard_id uuid not null,
  rating smallint not null check (rating between 1 and 3),
  state smallint not null,
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  scheduled_days integer not null,
  reviewed_at timestamptz not null default now(),
  constraint review_log_flashcard_fk foreign key (flashcard_id, user_id)
    references public.flashcards (id, user_id) on delete cascade
);

-- The card-side cascade.
create index review_log_flashcard_id_idx on public.review_log (flashcard_id);

-- ---------------------------------------------------------------------------
-- Row level security: own rows only; anon gets nothing. review_states has no delete policy (rows go away only
-- with their card); review_log is select and insert only.
-- ---------------------------------------------------------------------------

alter table public.review_states enable row level security;
alter table public.review_log enable row level security;

create policy "review_states_select_own" on public.review_states
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "review_states_insert_own" on public.review_states
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "review_states_update_own" on public.review_states
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "review_log_select_own" on public.review_log
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "review_log_insert_own" on public.review_log
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- review_state_from_json (internal helper of record_review and set_flashcard_mastered)
-- Parses the scheduler's state JSON { due, stability, difficulty, scheduled_days, learning_steps, reps, lapses,
-- state, last_review } into typed values. Missing keys, wrong JSON types, non-integer counts, negative values,
-- difficulty outside 0-10, state outside 0-3 or an unparsable timestamp → 22023. Extra keys are ignored.
-- ---------------------------------------------------------------------------

create function public.review_state_from_json(p_state jsonb)
returns table (
  due timestamptz,
  stability double precision,
  difficulty double precision,
  scheduled_days integer,
  learning_steps integer,
  reps integer,
  lapses integer,
  state smallint,
  last_review timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_key text;
begin
  begin
    if jsonb_typeof(p_state) is distinct from 'object'
      or jsonb_typeof(p_state -> 'due') is distinct from 'string'
      or jsonb_typeof(p_state -> 'last_review') not in ('string', 'null')
      or (p_state -> 'last_review') is null then
      raise exception 'invalid review state';
    end if;

    foreach v_key in array array['stability', 'difficulty', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state'] loop
      if jsonb_typeof(p_state -> v_key) is distinct from 'number' or (p_state ->> v_key)::numeric < 0 then
        raise exception 'invalid review state';
      end if;
    end loop;

    foreach v_key in array array['scheduled_days', 'learning_steps', 'reps', 'lapses', 'state'] loop
      if (p_state ->> v_key)::numeric <> trunc((p_state ->> v_key)::numeric) then
        raise exception 'invalid review state';
      end if;
    end loop;

    if (p_state ->> 'difficulty')::numeric > 10 or (p_state ->> 'state')::numeric > 3 then
      raise exception 'invalid review state';
    end if;

    return query select
      (p_state ->> 'due')::timestamptz,
      (p_state ->> 'stability')::double precision,
      (p_state ->> 'difficulty')::double precision,
      (p_state ->> 'scheduled_days')::integer,
      (p_state ->> 'learning_steps')::integer,
      (p_state ->> 'reps')::integer,
      (p_state ->> 'lapses')::integer,
      (p_state ->> 'state')::smallint,
      (p_state ->> 'last_review')::timestamptz;
  exception when others then
    -- Bad timestamps (22007/22008) and integer overflow (22003) are invalid states too.
    raise exception 'review_state_from_json: invalid review state' using errcode = '22023';
  end;
end;
$$;

revoke execute on function public.review_state_from_json(jsonb) from public, anon;
-- security invoker callers need it.
grant execute on function public.review_state_from_json(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- review_queue
-- General (p_tag_id null): non-mastered due cards (state > 0, due <= now()) by due, then non-mastered new cards
-- by created_at, id. Tag: every card of the tag, mastered included — due cards by due, then new cards by
-- created_at, id, then the rest by due. At most p_limit rows; p_limit outside 1-100 → 22023.
-- due and state are null for a card without a review_states row.
-- security invoker, so RLS limits every row to the caller's own cards and tags.
-- ---------------------------------------------------------------------------

create function public.review_queue(
  p_limit integer,
  p_tag_id uuid default null
)
returns table (
  id uuid,
  word text,
  translation text,
  additional_meanings text[],
  example_sentence text,
  cefr text,
  due timestamptz,
  state smallint,
  mastered boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'review_queue: limit must be 1-100' using errcode = '22023';
  end if;

  return query
  select
    f.id,
    f.word,
    f.translation,
    f.additional_meanings,
    f.example_sentence,
    f.cefr,
    rs.due,
    rs.state,
    rs.mastered_at is not null
  from public.flashcards f
  left join public.review_states rs on rs.flashcard_id = f.id
  where
    case
      when p_tag_id is null then
        rs.mastered_at is null
        and (rs.flashcard_id is null or rs.state = 0 or rs.due <= now())
      else
        exists (
          select 1 from public.flashcard_tags ft
          where ft.flashcard_id = f.id
            and ft.tag_id = p_tag_id
        )
    end
  order by
    case
      when rs.state > 0 and rs.due <= now() then 0
      when rs.flashcard_id is null or rs.state = 0 then 1
      else 2
    end,
    case when rs.state > 0 then rs.due end,
    f.created_at,
    f.id
  limit p_limit;
end;
$$;

revoke execute on function public.review_queue(integer, uuid) from public, anon;
grant execute on function public.review_queue(integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- record_review
-- Stores the state the scheduler computed for one rating and appends one review_log row, in one transaction.
-- Rating outside 1-3 or invalid state → 22023. Card not visible (missing or another user's) → P0002.
-- p_expected_reps is the reps value the scheduler started from (null when the card had no state row); if the
-- stored value differs (a double submit or a second tab got there first) → 40001 and nothing is written.
-- The compare-and-set is the update's / insert's own condition, so concurrent calls cannot both pass.
-- mastered_at is left untouched. security invoker, so RLS applies to every statement below.
-- ---------------------------------------------------------------------------

create function public.record_review(
  p_flashcard_id uuid,
  p_expected_reps integer,
  p_rating smallint,
  p_state jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state record;
  v_written int;
begin
  if p_rating is null or p_rating < 1 or p_rating > 3 then
    raise exception 'record_review: rating must be 1-3' using errcode = '22023';
  end if;

  select * into v_state from public.review_state_from_json(p_state);

  perform 1 from public.flashcards f where f.id = p_flashcard_id;
  if not found then
    raise exception 'record_review: flashcard not found' using errcode = 'P0002';
  end if;

  if p_expected_reps is null then
    insert into public.review_states (
      flashcard_id, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review
    )
    values (
      p_flashcard_id, v_state.due, v_state.stability, v_state.difficulty, v_state.scheduled_days,
      v_state.learning_steps, v_state.reps, v_state.lapses, v_state.state, v_state.last_review
    )
    on conflict (flashcard_id) do nothing;
  else
    update public.review_states rs
    set due = v_state.due,
        stability = v_state.stability,
        difficulty = v_state.difficulty,
        scheduled_days = v_state.scheduled_days,
        learning_steps = v_state.learning_steps,
        reps = v_state.reps,
        lapses = v_state.lapses,
        state = v_state.state,
        last_review = v_state.last_review
    where rs.flashcard_id = p_flashcard_id
      and rs.reps = p_expected_reps;
  end if;

  get diagnostics v_written = row_count;
  if v_written = 0 then
    raise exception 'record_review: review state changed since it was read' using errcode = '40001';
  end if;

  insert into public.review_log (flashcard_id, rating, state, due, stability, difficulty, scheduled_days)
  values (
    p_flashcard_id, p_rating, v_state.state, v_state.due, v_state.stability, v_state.difficulty,
    v_state.scheduled_days
  );
end;
$$;

revoke execute on function public.record_review(uuid, integer, smallint, jsonb) from public, anon;
grant execute on function public.record_review(uuid, integer, smallint, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- set_flashcard_mastered
-- Sets mastered_at = now() (p_mastered) or null on the card's state row; a card without a row gets one from
-- p_empty_state (the scheduler's starting state, so the card stays new). The FSRS columns of an existing row are
-- left untouched. Invalid p_empty_state → 22023. Card not visible (missing or another user's) → P0002.
-- security invoker, so RLS applies to every statement below.
-- ---------------------------------------------------------------------------

create function public.set_flashcard_mastered(
  p_flashcard_id uuid,
  p_mastered boolean,
  p_empty_state jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state record;
  v_mastered_at timestamptz := case when p_mastered then now() end;
begin
  if p_mastered is null then
    raise exception 'set_flashcard_mastered: mastered must be true or false' using errcode = '22023';
  end if;

  select * into v_state from public.review_state_from_json(p_empty_state);

  perform 1 from public.flashcards f where f.id = p_flashcard_id;
  if not found then
    raise exception 'set_flashcard_mastered: flashcard not found' using errcode = 'P0002';
  end if;

  insert into public.review_states (
    flashcard_id, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review,
    mastered_at
  )
  values (
    p_flashcard_id, v_state.due, v_state.stability, v_state.difficulty, v_state.scheduled_days,
    v_state.learning_steps, v_state.reps, v_state.lapses, v_state.state, v_state.last_review, v_mastered_at
  )
  on conflict (flashcard_id) do update
  set mastered_at = excluded.mastered_at;
end;
$$;

revoke execute on function public.set_flashcard_mastered(uuid, boolean, jsonb) from public, anon;
grant execute on function public.set_flashcard_mastered(uuid, boolean, jsonb) to authenticated;
