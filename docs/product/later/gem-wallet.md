# F12 · Gem economy & wallet

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M4 (earning) · M6 (real-money top-up, spending) · **Priority:** Foundation for F14/F15/F16

## Summary
Gems are the in-app currency. The wallet guarantees correct balances, supports **top-ups with real money**, and keeps a full, transparent **transaction history**.

## Rules (hard)
- **Ledger, not a balance column.** Every change is an immutable row in `gem_ledger` (id, user_id, amount ±, reason, ref_type, ref_id, idempotency_key, created_at). The balance is `sum(amount)`, exposed through a view or a cached `wallets.balance` maintained **only** by the same transaction.
- Clients can **never** insert or update ledger rows. All mutations go through server functions (Postgres `security definer` RPC or Edge Function) that:
  - run in a transaction with row locking (`select ... for update` on `wallets`),
  - reject overdrafts (balance never below 0),
  - use `idempotency_key` (unique) so retries don't double-credit.
- Reasons: `quiz_reward`, `wheel_prize`, `topup`, `store_purchase`, `refund`, `admin_adjust`.
- Real-money top-up: create a payment intent server-side, and credit gems **only from the payment provider's verified webhook** (never from a client redirect). Provider is TBD ([open questions](../../open-questions.md)).
- Wallet features are online-only.

## Acceptance criteria
- [ ] Concurrency test: 20 parallel spends of 10 gems on a 100-gem wallet produce exactly 10 successes.
- [ ] Replaying the same webhook twice credits once.
- [ ] The user's wallet page lists every ledger row with reason and date, and the sum equals the displayed balance.
- [ ] RLS: a user can read only their own ledger and can't write it.

## Data
`wallets`, `gem_ledger`, `payments` (provider, provider_ref, amount_thb, status, gems, raw webhook).
