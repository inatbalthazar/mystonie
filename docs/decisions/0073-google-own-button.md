# ADR 0073: Google's own sign-in button, so its chooser names our domain

**Status:** Accepted · **Date:** 2026-10-02 · Extends [ADR 0020](0020-auth-passwordless-ssr.md) and [ADR 0071](0071-sign-up-and-more-providers.md)

## Context
With the OAuth redirect through Supabase, Google's account chooser said "to continue to fuhwuwhiquysbfjmgtfi.supabase.co": the redirect URI's host, our Supabase project. The owner (2026-10-02) found that untrustworthy and asked for "continue to Mystonie".

What Google shows there:
- The app's name ("Mystonie") only once Google has verified the brand. That needs every authorized domain verified as ours in Search Console, and supabase.co can't be.
- Otherwise the domain that receives the sign-in.

## Decision
**Google Identity Services** (Google's own "Sign in with Google" button) on `/auth`, when `GOOGLE_CLIENT_ID` is set:
- **What it does:** it signs in on our page (a popup, or FedCM in Chrome) and hands back an ID token for our origin. The chooser says "to continue to mystonie.vercel.app".
- **Exchange:** the browser trades the token for a session with `signInWithIdToken`, with a nonce (Google signs its SHA-256, Supabase checks the raw one).
- **The callback's part:** `POST /api/auth/finish` does what `/api/auth/callback` does for the redirect flow (`afterSocialSignIn` in `src/data/sign-in.ts`): a new profile's locale and time zone, and the photo copy.
- **Fallback:** while Google's script loads, and if it can't (blocked, offline, 6 s), the redirect button stands in.
- **The script:** it comes from `accounts.google.com`, on the sign-in page only. There is no package (ADR 0006).
- **The button itself:** Google draws it: a pill, outline in light mode, black in dark mode, in the page's language, up to 400 px wide.

**Next, owner's step:** brand verification in Google Auth Platform → Branding, so the chooser says "Mystonie":
1. Verify `mystonie.vercel.app` in Search Console (an HTML tag).
2. Remove `supabase.co` from the authorized domains.

Google may not accept a `vercel.app` subdomain. If it doesn't, the brand domain (also needed for email, ADR 0019) is the way.

Rejected:
- **A Supabase custom domain** (`auth.<domain>`): the Pro plan plus an add-on, about 35 USD a month (free tier first).
- **Proxying Supabase's callback through our domain:** Supabase Auth builds the redirect URI from its own URL; a hosted project can't change it.
- **Leaving it:** the chooser is the first thing a new person sees.

## Consequences
- **Vercel:** `GOOGLE_CLIENT_ID` is the web client's id (public, the same one as in Supabase). Without it, `/auth` keeps the redirect button.
- **Supabase:** Providers → Google must keep that id in "Client IDs" (ID tokens are checked against it), with "Skip nonce checks" off.
- **Google client:** its Authorized JavaScript origins must list `https://mystonie.vercel.app` (and `http://localhost:3000` to try it locally).
- **Other providers:** Apple, Facebook, X and Discord still redirect. Their screens show the app's name already.
- **Testing:** the button can't be tested headless. It is the owner's real-device check, in Safari, where popups and third-party cookies are strictest (`itp_support`).
