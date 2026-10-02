# ADR 0055: Say Mystonie is in beta, show Pro without selling it, and let people report problems

**Status:** Accepted · **Date:** 2026-10-01

## Context
The owner (2026-10-01) wants several things to tell people that Mystonie is still in beta. For now, the Pro subscribe button should be grey and not clickable, but people should still be able to see the plans. They also want a place where people can report problems and bugs.

Before this change:
- `/pro` was a 404 while Pro was off (ADR 0034). Production has Pro off, so nobody could see the plans.
- The only way to report anything was Report on a public profile or a shared card, which is for abuse (ADR 0027). People could also email the operator's address from the Privacy page.

## Decision
**One flag.** `BETA` in `src/lib/site.ts` (true for now) turns on all the beta signs. At launch it becomes false, and one deploy turns them off.
- **Header:** a small coral **BETA** stamp next to the logo, on every page. It opens `/feedback`.
- **Footer:** "Mystonie is in beta. Report a problem" (signed out only since [ADR 0065](0065-app-footer.md)).
- **Settings:** a "Mystonie is in beta" card (stamped BETA) with a **Report a problem** button.
- **`/feedback`:** explains what beta means:
  - your collection is safe and can be exported
  - things change from week to week
  - every report is read
  - Pro isn't on sale yet, with a link to see it

**Pro is shown, not sold.**
- `/pro` no longer answers 404 when Pro is off. It shows:
  - the offer
  - both plans at the planned prices from the spec (`PLANNED_PRICES`: $2.99 a month, $19.99 a year, "Save 44%")
  - "Pro isn't on sale yet"
  - grey, disabled **Not on sale yet** buttons
  - "Planned prices … may change"
- Settings always has the Pro card. While Pro is off it reads "Not on sale during the beta. See what it will add."
- Selling is still controlled by ADR 0034's one switch (`PRO_ENABLED` and the Stripe keys). Production has it off, so the buttons are grey there. A machine with Stripe **test** keys (this one's `.env.local`) keeps Checkout working, so `e2e/pro.spec.ts` still runs.
- Pro card styles stay hidden while Pro is off, as before. (Since [ADR 0079](0079-pro-styles-on-show-and-card-swipe.md) they're on show, locked, with See Pro.)

**Report a problem** (`/feedback`, `POST /api/feedback`):
- **The form:** a kind (Something's broken · An idea · Something else) and a message of up to 2,000 characters. Signed-out visitors can send one too, so problems with signing in can be reported. Spam protection is the same as for reports: a honeypot, and 10 an hour per IP.
- **Sent along with the message:**
  - The page the person came from (`?from=`). Every "Report a problem" link adds it. Only the path is kept, never the query, which can hold sign-in or unsubscribe tokens.
  - The browser's user agent.
  - The language.
  - An error page's digest, when there is one.
  - For signed-in people, their account id and email, so the owner can reply.
- **Storage:** reports go in a new `feedback` table (service role only). The operator gets an email (Resend, or Mailpit in development) with a one-line SQL statement for changing the status.
- **"Your reports":** signed-in people see their reports (RLS: their own) with the status the operator sets in the Supabase dashboard (Received · On the list · Fixed · Closed).
- **Where the links are:**
  - the footer, Settings and the BETA stamp
  - a new error page (`src/app/[locale]/error.tsx`: "Something went wrong", **Try again** and Report this problem, with the digest; it also sends the error to Sentry when Sentry is set up)
  - the 404 page ("Followed a link here? Tell us it's broken")

Rejected:
- **A "beta" banner across the top of every page.** It takes space on the phone screen every time, and people learn to ignore it. The stamp by the logo is always there and doesn't get in the way.
- **Keeping `/pro` a 404 until launch.** The owner wants the plans to be visible.
- **A separate on-sale switch tied to `BETA`.** That would be a second Pro switch. Production already greys the buttons through ADR 0034's switch, and a second switch would break Checkout testing with test keys.
- **Reusing `reports`.** That table is for abuse on public things: it has a target and an abuse reason, and is never shown back to the reporter. Bugs and ideas need a message, a page and a status the reporter can see.
- **Only a mailto link.** No page or device is sent with it, there's nothing to track, and many phones have no mail app set up. The address is still offered to signed-out people who want a reply.
- **An external tool (a form service, GitHub issues, Canny).** It's another service and another account, and people would leave the app to use it.
- **Screenshots attached to reports.** They need storage and moderation. They can come later if text isn't enough.

## Consequences
- New migration `20261014090000_stage4_feedback.sql` (the `feedback` table). It is tested in `stage4_feedback.test.sql` and must be on the remote project before this code deploys.
- The JSON data export includes `feedback`. Deleting an account deletes its reports. The Privacy page says what a report stores.
- `/pro` is in the sitemap. `/feedback` is noindex.
- New analytics event `feedback_sent` (the kind only).
- `e2e/feedback.spec.ts` covers:
  - signed out and signed in, the operator's email and "Your reports"
  - Settings and the 404 page
  - `/pro` while it isn't on sale: this test skips when `PRO_ENABLED=true`, so run `pnpm dev` with `PRO_ENABLED=false` to check it
- At launch: set `BETA` to false. The stamp, the footer line and the Settings card's beta wording go. Report a problem stays, under "Feedback".
