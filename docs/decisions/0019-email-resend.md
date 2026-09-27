# ADR 0019: Email through Resend, with our own unsubscribe links

**Status:** Accepted (auth emails: superseded by [ADR 0020](0020-auth-passwordless-ssr.md), which sends them through the Send Email Hook instead of SMTP) · **Date:** 2026-09-27

## Context
Stage 1 sends three kinds of email:
- Supabase Auth mail (magic links and confirmations).
- The one-time **launch email** to the waitlist.
- Later, weekly recaps.

Supabase's built-in SMTP is for testing only: it allows 2 emails an hour. Open question Q8 defaulted to Resend's free tier. The Privacy Policy promises that every email has an unsubscribe link, and Gmail and Yahoo require one-click unsubscribe (RFC 8058) for bulk senders.

## Decision
- **Resend is the provider for both paths:**
  - its SMTP (`smtp.resend.com:465`, user `resend`, password = API key) is set as Supabase Auth's custom SMTP in the dashboard;
  - its REST API is called with `fetch` from route handlers (`src/data/email.ts`), with no SDK and no new package.
- Resend's free tier gives 3,000 emails a month, at most 100 a day, and 3 domains. Pro costs $20 a month for 50,000.
- Rejected alternatives:
  - **Postmark:** only 100 emails a month free.
  - **Amazon SES:** cheapest at volume, but needs an AWS account, sandbox approval and more setup than a solo project should carry now.
  - **Brevo:** marketing-first, and its free tier brands the emails.
  - **Supabase default SMTP:** too few emails.
- **The waitlist launch email is sent as transactional API batches from our app, not as a Resend Broadcast.** A Broadcast would need a copy of the list, and of its unsubscribe state, inside Resend. With batches, Postgres stays the only source of truth.
  - `POST /api/admin/launch-email` (bearer `ADMIN_SECRET`) sends to the next ≤ 100 subscribed rows that have `launch_sent_at` null, then stamps them.
  - A dry run renders without sending.
  - The idempotency key is derived from the rows, so a retry within 24 h can't double-send.
  - On the free tier the owner runs it once a day until `remaining` is 0, or takes Pro for the launch month.
- **Unsubscribe links are stateless and signed:** `?id=<waitlist id>&t=<HMAC-SHA256(id), 16 bytes, base64url>` with `UNSUBSCRIBE_SECRET` (`src/core/email/unsubscribe.ts`, Web Crypto).
  - The body link opens a confirm page (`/[locale]/unsubscribe`). A GET never unsubscribes, because mail scanners open links.
  - `List-Unsubscribe` + `List-Unsubscribe-Post` point to `POST /api/unsubscribe`, which mail apps call with one click.
  - Unsubscribing is idempotent and keeps the first date.
- **Email copy lives in `messages/*.json` (`Emails.*`)** and is rendered by `src/core/email/launch.ts` into table-based HTML with inline brand colours, plus a text part. It is sent in the recipient's waitlist locale.

## Consequences
- The owner must verify a sending domain in Resend (the brand domain once bought; `EMAIL_FROM` on that domain). They must also put the SMTP settings into Supabase (Authentication → Emails → SMTP) and raise the auth email rate limit there, and add `RESEND_API_KEY`, `EMAIL_FROM`, `UNSUBSCRIBE_SECRET` and `ADMIN_SECRET` in Vercel.
- `UNSUBSCRIBE_SECRET` must never change once emails are out, or older links stop working. Those people can still reply, and the page tells them so.
- Commercial email to US recipients needs a postal address in the footer (CAN-SPAM). The footer currently names the operator site only, so the owner adds an address (for example a PO box or virtual mailbox) before the launch send.
- Recaps (stage 1) reuse `sendEmailBatch` and the same unsubscribe scheme, extended to account emails.
- Resend is added to the Privacy Policy's processor list.
