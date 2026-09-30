-- Stage 2: Mystonie Pro (docs/product/features/S2-pro-subscription.md, ADR 0034).
-- One row per Stripe subscription, written only by the Stripe webhook route (service role) from verified events.
-- Pro is whatever these rows say: never a client redirect, never a client write (ADR 0003).

create table public.subscriptions (
  -- Stripe's ids: `sub_…` and `cus_…`.
  stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]{1,250}$'),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  stripe_customer_id     text not null check (stripe_customer_id ~ '^cus_[A-Za-z0-9]{1,250}$'),
  -- Stripe's subscription status. Pro while active, trialing or past_due (Stripe retries the payment).
  status                 text not null check (status in (
                           'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  price_id               text check (price_id ~ '^price_[A-Za-z0-9]{1,250}$'),
  current_period_end     timestamptz,
  -- Cancelled in the portal: Pro until `current_period_end`, then Stripe sends the subscription's deletion.
  cancel_at_period_end   boolean not null default false,
  -- `created` of the Stripe event this row was last written from: an older event (they can arrive out of
  -- order, and replays happen) never overwrites a newer one.
  event_at               timestamptz not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index subscriptions_user_id on public.subscriptions (user_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- Users see their own subscription (the Pro page, Settings). Nobody but the service role writes.
create policy "users read their own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));
