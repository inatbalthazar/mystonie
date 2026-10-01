-- Stage 4, more stickers (ADR 0063): badges for the Reel of the Day, monthly challenges, the warnings quiz, reviews,
-- Journal articles and supporting Mystonie. Their rules live in src/core/badges.ts and read rows that already exist
-- (reel_plays, challenge_joins, quiz_answers, entries, subscriptions); awards still go to user_badges, written by the
-- server alone. The one new thing: a Buy Me a Coffee tip names the supporter by email, so the tip webhook (service
-- role) gives the Supporter sticker to the account with that email. The email itself is not stored.

-- Gives the Supporter sticker to the account signed in with `p_email` (dated `p_at`), unless it has it already.
-- Returns whether such an account exists. Service role only: the tip webhook and the owner's admin route.
create function public.award_supporter(p_email text, p_at timestamptz)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account uuid;
begin
  select u.id into account
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
  if account is null then
    return false;
  end if;
  insert into public.user_badges (id, user_id, badge, earned_at)
  values (private.uuid_v7(), account, 'supporter', least(coalesce(p_at, now()), now()))
  on conflict (user_id, badge) do nothing;
  return true;
end;
$$;

revoke execute on function public.award_supporter(text, timestamptz) from public, anon, authenticated;
grant execute on function public.award_supporter(text, timestamptz) to service_role;
