-- Stage 4, the Journal as a feed (ADR 0052): Stamps and Saves on Journal articles. Articles are files in
-- content/journal/, not rows, so a mark names its article by slug; POST /api/journal/marks only takes the slugs of
-- published articles. User rows under the day-one rules (UUID v7, server-stamped updated_at, soft delete, no client
-- DELETE), like stamps on finishes (ADR 0037).

create table public.journal_marks (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  slug       text not null check (char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- stamp: kudos on the article; save: kept to read later (Saved on /journal and Me).
  kind       text not null check (kind in ('stamp', 'save')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.journal_marks is
  'Stamps and Saves on Journal articles (content/journal/<slug>). Only the person sees their own; Stamp counts are public through journal_stamp_counts() (ADR 0052).';

create unique index journal_marks_one_active on public.journal_marks (user_id, slug, kind) where deleted_at is null;
create index journal_marks_stamps on public.journal_marks (slug) where kind = 'stamp' and deleted_at is null;
create index journal_marks_user_id_updated_at on public.journal_marks (user_id, updated_at);

create trigger journal_marks_set_updated_at
  before update on public.journal_marks
  for each row execute function public.set_updated_at();

-- A cap on live marks per person and kind: the Journal has tens of articles, so this only stops scripts.
create function private.limit_journal_marks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is null
     and (select count(*) from public.journal_marks
          where user_id = new.user_id and kind = new.kind and deleted_at is null and id <> new.id) >= 1000 then
    raise exception 'too many journal marks' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.limit_journal_marks() from public, anon, authenticated;

create trigger journal_marks_limit
  before insert or update of deleted_at on public.journal_marks
  for each row execute function private.limit_journal_marks();

alter table public.journal_marks enable row level security;

create policy "people read their journal marks" on public.journal_marks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "people mark journal articles" on public.journal_marks for insert to authenticated
  with check (user_id = (select auth.uid()));
-- Taking a mark back is a soft delete; a new mark is a new row.
create policy "people update their journal marks" on public.journal_marks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.journal_marks from anon;
revoke insert, update, delete on public.journal_marks from authenticated;
grant insert (id, user_id, slug, kind) on public.journal_marks to authenticated;
grant update (deleted_at) on public.journal_marks to authenticated;

-- How many Stamps each article has, for everyone (the Journal's rows and article pages are public). Only counts:
-- who stamped stays private.
create function public.journal_stamp_counts()
returns table (slug text, stamps integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.slug, count(*)::int
  from public.journal_marks m
  where m.kind = 'stamp' and m.deleted_at is null
  group by m.slug;
$$;

revoke execute on function public.journal_stamp_counts() from public;
grant execute on function public.journal_stamp_counts() to anon, authenticated;
