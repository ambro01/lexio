-- AI content-quality stats (S-07): a read-only aggregation of the caller's proposal outcomes, so the server can
-- compute the quality rate without fetching every row. Additive: one new function, no table or data changes.

-- ---------------------------------------------------------------------------
-- proposal_outcome_stats
-- One row per (source, model, outcome, recent) with its row count n. recent = created_at within the last 30 days.
-- model is null for rows recorded without a model. security invoker, so RLS limits the rows to the caller's own.
-- ---------------------------------------------------------------------------

create function public.proposal_outcome_stats()
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
  group by 1, 2, 3, 4;
$$;

revoke execute on function public.proposal_outcome_stats() from public, anon;
grant execute on function public.proposal_outcome_stats() to authenticated;
