# S2 · Mystonie Pro

**Stage:** 2 · First revenue

## Offer
**$2.99/month or $19.99/year** (validate with a pricing test).
- Premium card templates and seasonal frames
- Custom colours and fonts on cards
- Advanced stats (all-time records, genre and language trends, comparisons)
- Early access to Year in Review

The free tier keeps the full core loop: logging, the 3 base templates, recaps and basic stats. **Pro never gates sharing itself.**

## Rules
- Payments: **Stripe Checkout + Customer Portal**. Entitlement comes only from verified Stripe **webhooks** (`subscriptions` table). Never trust a client redirect.
- Template metadata `tier: pro` gates the template in UI **and** on the server when saving a card.
- Prices are shown in USD (Stripe handles local currency display where enabled).
- Before launch: Vercel Pro plan, TMDB commercial terms, DTDD terms and a refund policy in Terms.

## As built
Decisions and alternatives: [ADR 0034](../../decisions/0034-pro-subscription.md). Built and tested in Stripe test mode, **off in production** until the owner go-live (roadmap).
- **Switch:** Pro exists only when `PRO_ENABLED=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and at least one of `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` are set. Otherwise Pro can't be bought: the billing routes answer 503 and Pro card styles aren't offered. `/pro` still shows the offer and the planned prices ($2.99 / $19.99, `PLANNED_PRICES`) with grey "Not on sale yet" buttons, and Settings links to it (the beta, [ADR 0055](../../decisions/0055-beta-and-feedback.md)).
- **What Pro adds today:** Pro card templates, starting with **Film Strip** (the poster as a frame of 35 mm film taped into the album, with a paper label; movies and series, Finish and Progress, story and feed). Custom colours and fonts, advanced stats and early Year in Review are not built yet.
- **Free stays free:** logging, the base templates, recaps, stats and sharing. A Pro template is shown to non-Pro users as a locked preview (Unlock → `/pro`, Download and Share off), and also while Pro isn't on sale yet (See Pro, [ADR 0079](../../decisions/0079-pro-styles-on-show-and-card-swipe.md)); it is never offered in the anonymous card maker.
- **`/pro`:** the offer, both plans with prices read from Stripe (yearly shows "Save N%"), Checkout, and for Pro users the renewal or "Cancelled: Pro stays on until …" date and **Manage subscription** (Customer Portal). Back from Checkout (`?checkout=success`) it checks every 2 s for up to a minute until the webhook has switched Pro on.
- **Settings:** a Pro section linking to `/pro` ("See Pro" / "Manage Pro"), shown whether or not Pro is on sale.
- **Routes:**
  - `POST /api/billing/checkout {plan}` → `{url}` (409 when already Pro, 10/min);
  - `POST /api/billing/portal` → `{url}` (404 without a Stripe customer);
  - `GET /api/billing/status` → `{available, pro, renewsAt, cancelAtPeriodEnd}`;
  - `POST /api/billing/webhook` (Stripe-signed, `customer.subscription.*` only).
- **Who is Pro:** a subscription that is active, trialing or past due, until 3 days after `current_period_end`. `POST /api/cards` refuses a Pro template with 403 `pro_required` otherwise.
- **Account deletion** cancels live subscriptions at Stripe first. The data export includes `subscriptions`.

## Acceptance criteria
- [x] Checkout → webhook → Pro templates unlock within seconds. (Webhook → unlock is covered by `e2e/pro.spec.ts` with signed events and by the `/pro` polling. Checked end to end on 2026-09-29 with the owner's Stripe **test** keys and `stripe listen`: yearly Checkout, Pro on, Film Strip unlocked, cancelled in the Customer Portal, all webhooks answered 200.)
- [x] Cancelling in the portal → access ends at period end. (`cancel_at_period_end` keeps Pro and shows the end date, `customer.subscription.deleted` ends it, and the period check ends it even without that event. `billing.test.ts` and `e2e/pro.spec.ts`.)
- [x] Replaying the same webhook is idempotent. (Upsert by subscription id, ordered by the event time: a replay rewrites the same row and an older event is ignored. `e2e/pro.spec.ts`.)

## Data
`subscriptions`: one row per Stripe subscription (id, user, customer, status, price, period end, cancel at period end, event time). See the [data model](../../architecture/data-model.md).
