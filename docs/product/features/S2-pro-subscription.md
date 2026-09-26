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

## Acceptance criteria
- [ ] Checkout → webhook → Pro templates unlock within seconds.
- [ ] Cancelling in the portal → access ends at period end.
- [ ] Replaying the same webhook is idempotent.

## Data
`subscriptions` (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end).
