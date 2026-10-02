# ADR 0034: Pro through Stripe's REST API, entitlements from subscription webhooks only, built and tested in test mode behind `PRO_ENABLED`

**Status:** Accepted, Pro templates on show even while Pro is off since [ADR 0079](0079-pro-styles-on-show-and-card-swipe.md) · **Date:** 2026-09-29

## Context
The stage 2 task "Stripe Pro subscription + premium templates" ([S2 Pro](../product/features/S2-pro-subscription.md)) was an owner task: Pro can't take real money before the owner moves to Vercel Pro and gets TMDB's commercial terms, since Vercel Hobby and TMDB's free API are both non-commercial. The owner wants as much as possible finished on free tiers, and chose to have Pro built and tested now in Stripe test mode (free), switched off until go-live.

AGENTS.md says money is server-authoritative: Pro comes only from verified Stripe webhooks, never from a client redirect ([ADR 0003](0003-server-authoritative-economy.md)). The single-app rule ([ADR 0006](0006-single-nextjs-app.md)) asks for an ADR before any new package.

## Decision
**No Stripe SDK.** The four calls we need (create a Checkout Session, create a portal session, read a price, cancel a subscription) go through `fetch` to Stripe's REST API as form-encoded bodies, pinned with `Stripe-Version: 2025-08-27.basil` (`src/data/stripe.ts`). Webhook signatures are checked with `node:crypto`: HMAC-SHA256 of `${t}.${body}` with the endpoint secret, compared in constant time, and refused when more than 300 s old, as Stripe's own libraries do. That is about 150 lines instead of a large dependency, and it's tested with signatures we make ourselves.

**One switch.** `stripeConfig()` returns null, and everything about Pro stays hidden, unless `PRO_ENABLED=true`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set, and at least one of `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` is set. While Pro is off:
- Pro templates are not offered;
- `/pro` is a 404 and Settings has no Pro section (since [ADR 0055](0055-beta-and-feedback.md), `/pro` and the Settings section show the offer with greyed-out buttons instead);
- the billing routes answer 503, and `/api/billing/status` says `{ available: false }`.

Production doesn't change until the owner turns it on.

**Entitlement from subscription events only.**
- The webhook (`/api/billing/webhook`) reads `customer.subscription.created`, `.updated` and `.deleted` and acknowledges every other event with `ignored`.
- Checkout puts our user id in `subscription_data.metadata.user_id`, so every subscription event carries it. We don't need `checkout.session.completed` or a lookup from customer to user.
- Each event upserts one row of `subscriptions`, keyed by the Stripe subscription id. `event_at` is the event's `created` time: an older event than the stored one is ignored, and a replay rewrites the same values. So retries and out-of-order delivery are both safe.
- A `.deleted` event always stores `canceled`.
- Users can read their own rows (RLS) but never write them; only the service role writes.

**Who is Pro** (`grantsPro` in `src/core/billing.ts`): a subscription whose status is `active`, `trialing` or `past_due`, and whose `current_period_end` plus 3 days hasn't passed.
- The grace covers a late renewal webhook.
- The period check ends Pro even if a cancellation webhook is lost.
- `past_due` keeps Pro while Stripe retries the card, as its dunning expects.
- The period end is read from the subscription, or from its first item (API versions from 2025 on move it there).

**Templates.** `TemplateMeta.tier: "pro"` marks a template, and `isProTemplate()` checks it.
- The celebration hides Pro templates when Pro is off. When Pro is on and the user isn't Pro, it shows them locked: a preview with an Unlock link to `/pro`, and Download and Share disabled.
- `POST /api/cards` refuses a Pro template with 403 `pro_required` unless the user is Pro. The anonymous card maker never offers Pro templates.
- Sharing itself is never gated: every free template shares as before.
- The first Pro template is **Film Strip**: the poster as the middle frame of a 35 mm strip taped into the album, with a paper label (movies and series, Finish and Progress, both sizes).

**Pages.**
- `/pro` shows the offer, with prices read from Stripe (cached for an hour) and Checkout for monthly or yearly.
- Once someone is Pro, the page shows the renewal or cancellation date and links to the Customer Portal.
- After Checkout, it polls `/api/billing/status` for up to a minute until the webhook has landed.
- Settings has a small Pro section.
- Checkout reuses the Stripe customer when the user already has one.

**Account deletion** cancels the user's live subscriptions at Stripe first, and fails rather than leaving a subscription billing a deleted account. The data export includes the `subscriptions` rows.

## Consequences
- No new package. Stripe API changes reach us only when we move the pinned version.
- Everything is testable without Stripe: `e2e/pro.spec.ts` runs the dev server with `PRO_ENABLED=true` and made-up keys and plays Stripe by posting signed events. It covers: locked, forged event refused, unlocked, replay, older event ignored, a Pro card saved, cancelled at period end, ended, and the server refusing a Pro card again. Checkout and the portal themselves need real Stripe test keys.
- The offer in the spec is bigger than what's built. Custom colours and fonts, advanced stats and early Year in Review are not Pro features yet, and only one Pro template exists.
- Going live is an owner checklist, in [the roadmap](../roadmap.md):
  - Vercel Pro, TMDB commercial terms and DTDD's Commercial tier (its free tier is non-commercial, [ADR 0035](0035-content-warnings-cache-and-survived.md));
  - a refund policy in Terms;
  - Stripe products and prices;
  - a webhook endpoint for `customer.subscription.*`;
  - the Customer Portal set up;
  - the env vars in Vercel;
  - migration `20260930090000_stage2_pro.sql` applied to the remote project.
