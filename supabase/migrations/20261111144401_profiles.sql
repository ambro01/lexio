-- Profiles (S-03): one settings row per user — the English level (CEFR) used to group "too easy"
-- proposals and the AI model used for generation. Additive: a new table, nothing existing changes.
-- ai_model is not constrained to a list: the selectable models live in app configuration
-- (src/lib/ai/models.ts), so the app validates it on save and on use.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cefr_level text null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  ai_model text null check (char_length(ai_model) between 1 and 100),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security: authenticated users read, create and change only their own row; anon gets
-- nothing. No delete policy: the row goes away only with the user (on delete cascade).
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
