-- Stage 3 badges (docs/product/features/S3-badges-shelf.md, ADR 0038): stickers earned from what you finish.
-- The catalogue and its rules live in code (src/core/badges.ts); this table only records who earned what, when.
-- Awards are written by the server alone (the service role, after it evaluated the user's own rows), so a client
-- can't give itself a sticker. They are never taken back: deleting the finishes behind one keeps it.

create table public.user_badges (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- The catalogue slug (`rookie-bookworm`); unknown slugs are ignored when read.
  badge      text not null check (badge ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(badge) <= 40),
  -- When the rule was met: the finish that got there (not when the server noticed).
  earned_at  timestamptz not null,
  -- The title whose finish earned it, if it is still in the catalogue.
  title_id   uuid references public.titles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_badges_once unique (user_id, badge)
);

create index user_badges_user_earned on public.user_badges (user_id, earned_at desc);
create index user_badges_title_id on public.user_badges (title_id);

alter table public.user_badges enable row level security;

-- The owner reads theirs; everyone reads those of a public, unblocked profile (like entries and the gallery).
create policy "users read their badges" on public.user_badges for select to authenticated
  using (user_id = (select auth.uid()));
create policy "badges of public profiles are readable" on public.user_badges for select to anon, authenticated
  using (private.is_public_profile(user_id));

-- No client writes at all: awards come from the service role.
revoke all on public.user_badges from anon;
revoke insert, update, delete, truncate, references, trigger on public.user_badges from authenticated;
grant select on public.user_badges to anon, authenticated;
