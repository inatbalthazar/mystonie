-- Stage 4, "What people said" on title pages (ADR 0051): the short reviews people wrote when they finished a title,
-- newest first, as Following feed rows. Only what entries' RLS already shows: the caller's own and the live entries
-- of public, unblocked profiles. Nothing new is stored.

create index entries_title_reviews on public.entries (title_id, finished_at desc, id desc)
  where status = 'finished' and deleted_at is null and review is not null;

create function public.title_reviews(p_title_id uuid, p_limit integer default 20)
returns table (
  entry_id uuid, finished_at timestamptz, rating numeric, review text,
  user_id uuid, username text, display_name text, avatar_url text,
  title_id uuid, title_kind text, title_source text, title_external_id text, title_name text, title_year integer,
  poster_path text, stamp_count integer, stamped boolean, card_id uuid, card_image_path text, finisher_no integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id)
  select e.id, e.finished_at, e.rating, e.review,
    p.id, p.username, p.display_name, p.avatar_url,
    t.id, t.kind, t.source, t.external_id, t.name, t.year, t.poster_path,
    (select count(*)::int from public.stamps s where s.entry_id = e.id and s.deleted_at is null),
    exists (select 1 from public.stamps s, me where s.entry_id = e.id and s.user_id = me.id and s.deleted_at is null),
    c.id, c.image_path, e.finisher_no
  from public.entries e
  join public.profiles p on p.id = e.user_id
  join public.titles t on t.id = e.title_id
  cross join me
  left join lateral (
    select c.id, c.image_path from public.cards c
    where c.entry_id = e.id and c.user_id = e.user_id and c.kind = 'finish'
      and c.shared_at is not null and c.deleted_at is null
    order by c.shared_at desc
    limit 1
  ) c on true
  where e.title_id = p_title_id
    and e.status = 'finished'
    and e.deleted_at is null
    and e.review is not null
    and btrim(e.review) <> ''
    and e.finished_at <= now() + interval '1 day'
    and p.username is not null
    and (e.user_id = me.id or (p.visibility = 'public' and not private.is_blocked_between(e.user_id, me.id)))
  order by e.finished_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.title_reviews(uuid, integer) from public, anon;
grant execute on function public.title_reviews(uuid, integer) to authenticated;
