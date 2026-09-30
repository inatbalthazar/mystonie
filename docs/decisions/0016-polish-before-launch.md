# ADR 0016: Build stages 0–2 before launch, with an agent-made design system

**Status:** Accepted · **Date:** 2026-09-26

## Context
The roadmap gated each stage on the previous stage's pass criteria (e.g. stage 1 only after 500 cards and 100 waitlist sign-ups), so the card maker would launch alone and the collection app would follow user growth. The design system was to come from a freelance designer before launch.

## Decision
- The owner wants the product **beautiful and ready to use before anyone sees it**. Stages 0, 1 and 2 are built back to back and launched together after stage 2. Pass criteria become **success measures** after launch.
- The agent does the **design pass** (logo, icons, tokens, type, polished screens, v1 card templates) from [design direction](../design/design-direction.md). A designer may refine it later; templates stay swappable through the registry.
- Unchanged: one stage at a time in roadmap order; `docs/product/later/` stays gated on its own metrics and the owner's go; single Next.js app + Supabase. (Amended by [ADR 0036](0036-expansion-features-before-launch.md): most of `later/` is now stage 3, built before launch.)

## Consequences
- Longer time to first user (roughly 3–5 months instead of 3–4 weeks), and no real-user feedback before stage 1/2 decisions. Analytics and the waitlist still ship, so measurement starts on day one.
- Stage 2 items that need paid or contracted access (TMDB commercial terms, DTDD key, Stripe live mode) are built against test keys/mocks and switched on when the owner has them.
- The stage 0 production deploy stays live as a preview; the waitlist keeps collecting emails.
