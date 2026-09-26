# ADR 0003: Server-authoritative economy (Gems, wheel, quiz, payments)

**Status:** Accepted, applies to Pro billing (stage 2) and all later economy features · **Date:** 2026-09-23

## Context
Gems can be bought with real money and exchanged for physical merchandise, so they have real value. Any client-side computation (random wheel results, quiz scoring, balances, daily limits based on device time) can be cheated.

## Decision
- All economy mutations run on the server: Supabase Edge Functions or `security definer` Postgres functions. Clients have **no** insert/update RLS policies on economy tables.
- Balances derive from an append-only **`gem_ledger`** with unique idempotency keys, and mutations use row locks inside a transaction.
- The wheel result (prize + stop angle) is generated server-side with a CSPRNG. The client only animates.
- Daily limits (wheel spins, rewarded quizzes) key on the **server UTC date** with unique constraints.
- Quiz timing uses server `served_at` / `answered_at`.
- Payment success comes only from **verified webhooks**.

## Consequences
- The economy doesn't work offline (acceptable; the UI must say so).
- More server code and DB tests (concurrency, idempotency) are needed before launch.
