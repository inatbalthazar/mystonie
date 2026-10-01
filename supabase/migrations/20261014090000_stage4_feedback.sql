-- Stage 4: "Report a problem" while Mystonie is in beta (ADR 0055). Bugs, ideas and anything else, written by
-- POST /api/feedback with the service role (honeypot, rate limit; signed-out visitors too), emailed to the operator.
-- The operator sets `status` (Supabase dashboard); a signed-in reporter reads their own reports and sees it.

create table public.feedback (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  -- Null for a signed-out visitor. Deleting the account deletes its reports, like every user row.
  user_id    uuid references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('bug', 'idea', 'other')),
  message    text not null check (char_length(message) between 1 and 2000),
  -- The page it was sent from: a path on the site, without its query.
  page       text check (char_length(page) between 1 and 300 and page like '/%'),
  -- An error page's digest, to find the error in the logs.
  error_ref  text check (char_length(error_ref) between 1 and 64),
  -- The browser's user agent.
  device     text check (char_length(device) between 1 and 300),
  locale     text not null default 'en' check (char_length(locale) between 2 and 10),
  status     text not null default 'new' check (status in ('new', 'planned', 'fixed', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_user_id on public.feedback (user_id, created_at desc);
create index feedback_open on public.feedback (created_at) where status in ('new', 'planned');

create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;

create policy "Reporters read their own reports"
  on public.feedback for select
  to authenticated
  using (user_id = (select auth.uid()));
