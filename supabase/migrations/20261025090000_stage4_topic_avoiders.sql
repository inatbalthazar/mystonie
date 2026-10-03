-- Stage 4, warnings quiz rewards (ADR 0094): "12 people on Mystonie avoid this. Your answer helps them." How many
-- people chose to avoid a warning topic (Settings → Content warnings), not counting the caller. A total only, never who,
-- and nothing under 3, so a small count can't point at someone.

create index user_avoid_topics_topic_id on public.user_avoid_topics (topic_id) where deleted_at is null;

create function public.topic_avoiders(p_topic text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.n >= 3 then c.n else 0 end
  from (
    select count(distinct a.user_id)::integer as n
    from public.user_avoid_topics a
    join public.warning_topics w on w.dtdd_id = a.topic_id
    where w.slug = p_topic
      and a.deleted_at is null
      and a.user_id <> (select auth.uid())
  ) c
  where (select auth.uid()) is not null;
$$;

revoke execute on function public.topic_avoiders(text) from public, anon;
grant execute on function public.topic_avoiders(text) to authenticated;
