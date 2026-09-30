-- Stage 3: games (S3 games, ADR 0044). A fifth catalog: games come from RAWG (`titles.source = 'rawg'`,
-- `kind = 'game'`) with RAWG's average playtime and platforms. The hours a player gives for a game sit on their entry.
-- Our own scene warnings cover games too, for the whole game (a game has no fixed timeline to place them on).

-- ---------------------------------------------------------------------------
-- titles: the new kind and source, and what a game adds.
-- ---------------------------------------------------------------------------
alter table public.titles drop constraint titles_kind_check;
alter table public.titles add constraint titles_kind_check check (kind in ('movie', 'series', 'book', 'manga', 'game'));
alter table public.titles drop constraint titles_source_check;
alter table public.titles add constraint titles_source_check check (source in ('tmdb', 'google_books', 'anilist', 'rawg'));

alter table public.titles
  -- RAWG's average playtime in hours (it says 0 when it doesn't know, stored as null).
  add column playtime_hours smallint check (playtime_hours between 1 and 10000),
  -- The platform families a game came out on ("PC", "PlayStation", …); empty for everything else.
  add column platforms text[] not null default '{}' check (cardinality(platforms) <= 8);

-- ---------------------------------------------------------------------------
-- entries: the hours someone played a game, asked after the celebration like the rating (optional). Stats use it
-- instead of RAWG's average.
-- ---------------------------------------------------------------------------
alter table public.entries add column hours_played smallint check (hours_played between 1 and 9999);

grant insert (hours_played), update (hours_played) on public.entries to authenticated;

-- ---------------------------------------------------------------------------
-- Scene warnings: every topic applies to games too (jump scares, flashing lights and loud noises most of all).
-- ---------------------------------------------------------------------------
alter table public.warning_topics drop constraint warning_topics_kinds_check;
alter table public.warning_topics add constraint warning_topics_kinds_check
  check (cardinality(kinds) > 0 and kinds <@ array['movie', 'series', 'book', 'manga', 'game']);

update public.warning_topics set kinds = kinds || '{game}'::text[] where not ('game' = any (kinds));

-- As in stage 3 warnings & quiz, plus: a game's warning has no place (no season, time or chapter).
create or replace function private.check_scene_warning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  title_kind text;
  topic_row public.warning_topics;
begin
  select t.kind into title_kind from public.titles t where t.id = new.title_id;
  select * into topic_row from public.warning_topics w where w.slug = new.topic;
  if topic_row.slug is not null and (not topic_row.active or not (title_kind = any (topic_row.kinds))) then
    raise exception 'topic % is not for a %', new.topic, title_kind using errcode = '23514';
  end if;
  if (title_kind = 'movie' and (new.season is not null or new.unit is not null))
     or (title_kind = 'series' and new.unit is not null)
     or (title_kind in ('book', 'manga') and (new.season is not null or new.start_sec is not null))
     or (title_kind = 'book' and new.unit not in ('chapter', 'page'))
     or (title_kind = 'manga' and new.unit not in ('chapter', 'volume'))
     or (title_kind = 'game' and (new.season is not null or new.start_sec is not null or new.unit is not null)) then
    raise exception 'that place does not fit a %', title_kind using errcode = '23514';
  end if;
  if new.user_id is not null
     and (select count(*) from public.scene_warnings w
          where w.user_id = new.user_id and w.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many warnings today' using errcode = '23514', hint = 'daily_limit';
  end if;
  new.status := 'pending';
  new.confirms := 1;
  new.disputes := 0;
  return new;
end;
$$;

revoke execute on function private.check_scene_warning() from public, anon, authenticated;
