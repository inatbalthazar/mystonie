# F14 · Daily lucky wheel

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M6 · **Priority:** Engagement (DAU)

## Summary
One free spin per day for small rewards (mostly Gems) to bring users back daily.

## Rules (hard)
- **The result is computed only on the server** (Edge Function `wheel-spin`). The client sends "spin" and receives `{ prize, angle_deg, next_spin_at }`, then animates the wheel to exactly that angle. The client never picks, weights or validates prizes.
- Randomness: crypto-secure RNG on the server, weighted by the `wheel_prizes` table (label, gems, weight, active).
- **Daily lock uses server UTC time.** One spin per user per UTC day, enforced by a unique constraint on `(user_id, spin_date_utc)`. Device clock changes have no effect.
- Crediting the prize writes to the gem ledger in the same transaction as the spin row ([F12](gem-wallet.md)), with the spin id as idempotency key.
- Online-only.

## Acceptance criteria
- [ ] Two rapid spin requests on the same UTC day: one succeeds, one gets `already_spun` with `next_spin_at`.
- [ ] Changing the phone's clock does not allow a second spin.
- [ ] Over 10,000 simulated spins, prize distribution matches weights within tolerance (server test).
- [ ] The wheel always stops on the prize the server returned.

## Data
`wheel_prizes`, `wheel_spins` (id, user_id, spin_date_utc, prize_id, angle_deg, created_at).
