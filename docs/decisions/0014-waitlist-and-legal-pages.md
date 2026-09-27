# ADR 0014: Waitlist sign-up and legal pages

**Status:** Accepted · **Date:** 2026-09-26

## Context
Stage 0 needs a waitlist (pass criterion: ≥ 100 sign-ups) with a honeypot, consent and a rate limit, plus Privacy and Terms pages ([S0 spec](../product/features/S0-card-maker.md)). A few details had real alternatives.

## Decision
- **Consent by submitting, no checkbox.** The form shows the consent line ("We'll email you when the app launches. Unsubscribe anytime.") with a Privacy link under the field, and `consent_at` is stamped by the server on submit. A checkbox adds a tap for the same legal effect: the purpose is stated, specific and opt-in by the act of submitting.
- **Where the form appears:** on the first screen while no title is picked (`placement=home`), and in the card editor **only after Share or Download** (`placement=after_card`), so the card comes first. `waitlist.source` stores the placement plus landing `ref` / `tpl` / `utm_*` as a query string.
- **Duplicates look like success.** A known email returns `{ ok: true }` and keeps its first locale and source, so the endpoint can't be used to test who is on the list. A previously unsubscribed email is re-subscribed with a fresh `consent_at`.
- **Honeypot answers like a real sign-up** (`200 { ok: true }`, nothing stored). Rate limit: 5 requests / 10 min per salted IP hash, counted before parsing. Unlike search, the waitlist **fails closed** (`503`) when Supabase is missing, because there's nowhere to store the email.
- **Legal text is English only**, in `messages/en.json` (`Privacy`, `Terms`); other locales fall back to it, with their own UI chrome. A translated legal text is a second version to keep in sync and can disagree with the English. Operator contact lives in `src/lib/legal.ts`. The texts are a plain-language starting point written by an agent, not legal advice; the owner should have them reviewed before paid features or large-scale email.
- No Turnstile / CAPTCHA until spam shows up (open question Q9).

## Consequences
- `POST /api/waitlist` is the only writer of `waitlist`; RLS still blocks clients.
- The waitlist does nothing in production until a Supabase project is configured on Vercel.
- When PostHog lands, `waitlist_joined` should fire on the success state of `WaitlistForm`.
