-- AI content-quality stats (S-07, review fix): proposal_outcome_stats filters by the caller explicitly instead of
-- relying on RLS alone, so a service-role caller (which bypasses RLS) gets no rows rather than every user's counts.
-- Same signature and result; create or replace keeps the existing grants.

create or replace function public.proposal_outcome_stats()
returns table (source text, model text, outcome text, recent boolean, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    po.source,
    po.model,
    po.outcome,
    po.created_at >= now() - interval '30 days' as recent,
    count(*) as n
  from public.proposal_outcomes po
  where po.user_id = (select auth.uid())
  group by 1, 2, 3, 4;
$$;
