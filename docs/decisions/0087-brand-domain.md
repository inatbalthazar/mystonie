# ADR 0087: mystonie.com is the site's address

**Status:** Accepted · **Date:** 2026-10-03 · Follows [ADR 0011](0011-name-mystonie.md) (the name)

## Context
The owner bought `mystonie.com` at Spaceship on 2026-10-03 and wants the site's name and domain to match everywhere. Until now the site lived at `mystonie.vercel.app`:
- the sign-in setup, Google's button and the docs all named that address;
- emails had no domain to send from (ADR 0019);
- the code's examples used `mystonie.app`, which was never bought.

## Decision
**`https://mystonie.com` is the one address:**
- **Vercel:** the project serves `mystonie.com`, and `www.mystonie.com` redirects to it with a 308. `NEXT_PUBLIC_SITE_URL=https://mystonie.com` is set for production, so `siteUrl()` gives it to metadata, the sitemap, emails, share and unsubscribe links. Nothing else in the code names a domain.
- **`mystonie.vercel.app`** redirects (308) to `mystonie.com`, with the path and query kept, so links already shared still land. The redirect is in `next.config.ts` (`redirects()`, matching that exact host only, so preview deployments keep their own URLs), because the Vercel tools can't edit an existing domain.
- **The code's examples and tests** use `mystonie.com` in place of `mystonie.app`.
- **Contact emails** (`src/lib/legal.ts`, switched 2026-10-03 once forwarding worked):
  - `privacy@mystonie.com` on the Privacy and Terms pages.
  - `hello@mystonie.com` on Report a problem, and as the push service's contact.
  - The app's own mail to the team (beta reports, reported profiles and cards) goes straight to the owner's Gmail (`teamInbox`). Mail sent from our domain and forwarded back can land in spam.
- **Mail:**
  - Receiving uses free email forwarding into Gmail, not a paid mailbox. Spacemail was declined at checkout.
  - Sending (sign-in codes, recaps, the launch email) goes through Resend on the verified domain.

**Rejected:**
- **Keeping `www` as the main address:** shorter is better for shared cards.
- **`mystonie.app`:** not bought, and one domain is enough for now. ADR 0011's typo domains stay optional.

## The switch (owner, in this order)
1. **Spaceship DNS** (Domain list → mystonie.com → Nameservers & DNS → Advanced DNS):
   1. Delete the parking records (the `A` records on `@` and the `CNAME` or `A` on `www`).
   2. Add `A` `@` → `76.76.21.21`.
   3. Add `CNAME` `www` → `cname.vercel-dns.com`.
2. **Vercel:** wait until Project → Settings → Domains shows both domains as Valid (minutes to an hour). Then redeploy, so `NEXT_PUBLIC_SITE_URL` takes effect, and set `mystonie.vercel.app` to redirect (308) to `mystonie.com`.
3. **Supabase** (Authentication → URL Configuration):
   - Set the Site URL to `https://mystonie.com`.
   - Add `https://mystonie.com/**` to the Redirect URLs.
   - Keep `https://mystonie.vercel.app/**` and `http://localhost:3000/**`.
4. **Google Cloud** (APIs & Services → Credentials → the web client):
   - Add `https://mystonie.com` to Authorized JavaScript origins.
   - On the OAuth consent screen, set the home page, privacy (`/privacy`) and terms (`/terms`) links to `mystonie.com`, and add `mystonie.com` as an authorized domain.
5. **Meta, X, Discord, Apple** (whichever are on):
   - Change the app's website, privacy and terms URLs to `mystonie.com`.
   - The OAuth redirect URI stays Supabase's `https://fuhwuwhiquysbfjmgtfi.supabase.co/auth/v1/callback`.
6. **Resend:**
   1. Add the domain `mystonie.com` and put the records it shows (SPF `TXT`, DKIM `TXT`, an `MX` on `send`) in Spaceship DNS.
   2. Once it's verified, set `EMAIL_FROM` in Vercel to `Mystonie <hello@mystonie.com>` and redeploy.
7. **Email forwarding** (done 2026-10-03): in Spaceship (Email forwarding, free), "To a single address" sends every `@mystonie.com` address to the owner's Gmail. Forwarded mail can land in spam. A Gmail filter on `to:(@mystonie.com)` with "Never send it to Spam" fixes that.
8. **Search Console** (optional): add the domain property `mystonie.com` (a `TXT` record) and submit `https://mystonie.com/sitemap.xml`.

## Consequences
- Every link the app makes (share cards, emails, the sitemap) uses `mystonie.com` after the next deploy, with no code change: it comes from `siteUrl()`.
- Older ADRs keep naming `mystonie.vercel.app` as history.
