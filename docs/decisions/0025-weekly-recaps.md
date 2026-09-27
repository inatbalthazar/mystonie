# ADR 0025: Weekly recaps from pg_cron, emailed with a link to the card

**Status:** Accepted · **Date:** 2026-09-27

## Context
[S1 share artwork](../product/features/S1-share-artwork.md) asks for a Weekly Recap:
- the user's local week;
- "titles finished, episodes, hours, poster collage";
- only for users who watched something;
- email first, web push only for installed PWAs;
- arriving on Monday morning (open question Q2: Monday 09:00 in the user's time zone).

Other constraints:
- The architecture overview already names pg_cron → an authenticated route handler for scheduled work.
- Cards render in the browser ([ADR 0008](0008-client-side-card-rendering.md)).
- Email goes through Resend ([ADR 0019](0019-email-resend.md)).

## Decision
- **An hourly pg_cron job calls `POST /api/cron/weekly-recaps`** (bearer `CRON_SECRET`), through `pg_net`.
  - The app URL and the secret come from Supabase Vault (`app_url`, `cron_secret`), set once per environment. Without them the job does nothing.
  - Rejected: Vercel Cron. Hobby allows one run a day, which can't reach every time zone at 09:00.
  - Rejected: Supabase Edge Functions or Trigger.dev. Another runtime or service (ADR 0006).
- **Who is due is decided in SQL** (`weekly_recap_candidates`, service role only): local time is Monday 09:00 or later, there is no recap yet for the week before, and something was watched in it (an episode logged or a title finished).
  - `timestamp at time zone` turns the local week bounds into instants, DST included.
  - Every later hour of that Monday picks up whatever a failed run missed.
  - Zones with :30/:45 offsets get theirs at 09:35 / 09:50.
- **The week is Monday–Sunday for everyone**, not the locale's week start.
  - The recap arrives on Monday, so it should end yesterday.
  - Our locale tags are bare languages (`en`, `th`), whose CLDR week starts on Sunday by US convention, not the user's region's.
  - The stats page can still follow the locale.
- **The numbers come from `titleWatch`** (`weeklyRecap` in `src/core/stats/recap.ts`), so they match the collection header and the stats page.
  - The collage keeps the 4 most watched titles.
  - The route stores the `CardRecap` snapshot in `weekly_recaps.stats` (unique per user and week, so reruns are safe).
- **The email carries the numbers and a poster strip, not the card image.** The button opens `/recap/[id]` (signed in, owner only), where the card renders in the browser, in the celebration (Share / Download / Change style / Sticker), as ADR 0008 planned.
  - Rejected: rendering PNGs on the server for the email (needs a headless browser for Thai/CJK text).
- **Recap cards:**
  - They are a new `weekly_recap` card kind, with `CardData.recap` set (the top title stands in for name, poster and palette).
  - Templates: the new **Collage** (an album page with the posters taped in) and **Bold Stats**. The Sticker works too.
  - Saving one links it to its recap (`weekly_recaps.card_id`).
- **Recap emails can be turned off:**
  - through `profiles.email_recaps` (Settings → Emails, `PATCH /api/account`);
  - through the email's unsubscribe link: signed per list (`list=recaps`, the HMAC covers the list), the same confirm page and one-click `List-Unsubscribe`.
  - Waitlist links keep working unchanged.
  - Recaps are still made for people who opted out. The collection page shows a "Your week is in" note for 7 days.
- **Sending:** at most 100 per run through `sendEmailBatch`, with an idempotency key from the rows. A recap made in the last 2 days whose email hasn't gone out is retried, and older ones are dropped. In development without Resend the emails go to Mailpit.
- **Web push waits for the PWA.** There is no install yet (the Home task adds the manifest and install prompt), and iOS only allows push for installed apps. Push moves to the Home task (built in [ADR 0028](0028-home-pwa-web-push.md)).

## Consequences
- The remote project needs `20260927130000_stage1_weekly_recaps.sql` (with the other stage 1 migrations), then the two Vault secrets, and `CRON_SECRET` in Vercel (Sensitive, the same value as the Vault secret).
- The Resend free tier (100 emails a day, shared with sign-in codes) covers about 80 active users a week. Past that, Resend Pro, or spreading sends over Monday (the job already runs hourly).
- Local testing needs `CRON_SECRET` and `UNSUBSCRIBE_SECRET` in the dev server's environment. Development accepts `{ "now": "<ISO>" }` to act as another moment (`e2e/recap.spec.ts`); production ignores it.
- Recap day and time are fixed for now (Q2); making them a setting means a column and a change to the candidates query.
