-- Stage 4: a short bio on the album's cover (ADR 0057). Plain text, up to 160 characters and 4 lines, set in
-- Settings by its owner and shown to visitors only while the profile is public (through public_profile()).
-- No nationality, gender or age fields: nothing uses them (ADR 0057).

alter table public.profiles
  add column bio text check (
    char_length(bio) between 1 and 160
    -- no control characters but line breaks, and at most 4 lines
    and bio !~ '[\x01-\x09\x0b-\x1f\x7f]'
    and char_length(bio) - char_length(replace(bio, E'\n', '')) <= 3
  );

grant update (bio) on public.profiles to authenticated;

-- /u/[username]: the same as before, plus the bio while the profile is visible to the viewer.
drop function public.public_profile(text);
create function public.public_profile(p_username text)
returns table (
  id uuid, username text, display_name text, avatar_url text, is_private boolean, created_at timestamptz,
  blocked_by_me boolean, bio text
)
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select p.*,
      p.visibility = 'public' and not private.is_blocked_between(p.id, (select auth.uid())) as visible,
      exists (select 1 from public.blocks b
              where b.blocker_id = (select auth.uid()) and b.blocked_id = p.id and b.deleted_at is null) as blocked_by_me
    from public.profiles p
    where p.username = lower(p_username)
  )
  select
    case when visible or blocked_by_me then id end,
    username,
    case when visible then display_name end,
    case when visible then avatar_url end,
    not visible,
    case when visible then created_at end,
    blocked_by_me,
    case when visible then bio end
  from p;
$$;

revoke execute on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;
