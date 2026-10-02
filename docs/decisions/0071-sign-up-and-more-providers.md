# ADR 0071: A way in on the landing page, and more social sign-ins

**Status:** Accepted · **Date:** 2026-10-02 · Extends [ADR 0020](0020-auth-passwordless-ssr.md) and [ADR 0064](0064-facebook-sign-in-and-photos.md)

## Context
The owner (2026-10-02) looked at https://mystonie.vercel.app and found no sign-up. They want people to sign up with social media accounts, and with whatever other accounts the app should have.

What production showed that day:
- **The landing page's only call to action was stage 0's waitlist** ("Join the waitlist"). The way to `/auth` was a small "Sign in" in the header.
- **`/auth` offered email only.** Google and Facebook were built (ADR 0020, ADR 0064), but neither was switched on in Supabase Auth, so their buttons didn't show.
- **Email sign-up only worked for the owner.** No Send Email Hook was set, so Supabase's built-in mailer sent the codes (`noreply@mail.app.supabase.io`). That mailer only delivers to the project team's own addresses, a few an hour. Going live with email needs Resend and a domain of our own (roadmap 🧑 Email go-live, Auth go-live).
- The Supabase Auth logs showed redirects to `http://localhost:3000`: the Site URL still pointed at development.

## Decision
**The landing page leads to sign-up:**
- **The hero:** a coral "Start your collection, free" under the intro, to `/auth`. Signed in, the same spot says "Open your collection" and goes to Home. CSS picks one (`signed-out:` / `signed-in:`), so the page stays static.
- **Under the card maker, and after a card is shared or downloaded:** `SignUpPrompt` replaces the waitlist's form. It has:
  - "Keep everything you finish in one collection." (after a card: "Save this card, and every one after it, in your collection.");
  - "Start your collection";
  - "Already have an account? Sign in".
- **The waitlist's form is gone.** The app is open in beta, so asking to wait made no sense. Its API, its table and the launch email stay for the people already on the list (ADR 0019).
- **One `/auth` for both.** Sign-up and sign-in stay the same step on `/auth`, which keeps its title.

**Sign-in providers.** Each shows only when switched on in Supabase Auth, as before. The buttons come in this order, each in its brand's own colours:
1. **Google:** the most common account worldwide. Free.
2. **Apple:** what iPhone people expect, with "Hide my email". Black, white in dark mode.
   - It needs the Apple Developer Program (99 USD a year).
   - So it stays off until the owner chooses to pay for it (free tier first). ADR 0020 had it wait for an iOS app; the button is ready either way.
3. **Facebook:** as ADR 0064. Now a pill like the rest.
4. **X:** where people post about what they watch. Free. Black, white in dark mode. Supabase calls it `twitter`.
5. **Discord:** where the games and anime crowd is. Free. Discord's blurple.

`OAUTH_PROVIDERS` in `src/core/avatar.ts` lists them, and Settings → "Signed in with" names each one.

**Photos (ADR 0064) come from every provider that has one:**
- X's 48 px link becomes its 400 px one (`_normal` → `_400x400`).
- Discord's link asks for `size=512`.
- Apple gives no photo, so the initial shows until one is uploaded.

The privacy policy now names all five providers and says we ask only for the name, email and photo.

**Rejected:**
- **Instagram:** no sign-in for people's accounts (ADR 0064).
- **LINE, Kakao, VK and other national networks:** each signals a home country (ADR 0007). Supabase also has no LINE provider.
- **TikTok:** Supabase has no provider for it. It would need our own OAuth code.
- **GitHub, GitLab, Bitbucket, Microsoft, Slack, Notion, Figma, Zoom and the like:** work and developer accounts, not where people who log shows come from.
- **Spotify and Twitch:** small overlap with the audience. Each one is a line in `OAUTH_PROVIDERS` later if asked.
- **Phone numbers (SMS codes):** each SMS costs money (Twilio), and a phone number is more personal than we need.
- **Passwords:** still no (ADR 0020).
- **Social buttons on the landing page itself:** the page is static and cached for an hour, while the switched-on providers live in Supabase. A tap to `/auth` costs one step and keeps one place that knows them.

## Consequences
**Owner setup:** each provider is turned on in Supabase → Authentication → Sign In / Providers. Every provider's redirect (callback) URL is `https://fuhwuwhiquysbfjmgtfi.supabase.co/auth/v1/callback`.
- **Google:** Google Cloud Console.
  1. Create an OAuth consent screen (external, publishing status "In production"; the basic scopes need no review).
  2. Create an OAuth client of type "Web application", with that redirect URI.
  3. Paste its Client ID and Secret into Supabase.
- **Facebook:** as ADR 0064.
- **X:** developer.x.com, free tier.
  1. Create a project and app.
  2. Under User authentication settings, choose a Web App with that callback, add the website and the Terms and Privacy URLs, and turn on "Request email from users". Without the email, Supabase refuses the sign-up.
  3. Paste the API Key and Secret into Supabase's Twitter provider.
- **Discord:** discord.com/developers.
  1. Create an application.
  2. Under OAuth2, add that redirect.
  3. Paste the Client ID and Secret into Supabase.
- **Apple:** only if the owner pays for the Apple Developer Program. In Supabase, it needs a Services ID, a key and the team ID.
- **URL configuration, before any of them:** in Supabase → Authentication → URL Configuration:
  - set the Site URL to `https://mystonie.vercel.app` (the brand domain later);
  - add `https://mystonie.vercel.app/**` and `http://localhost:3000/**` to the Redirect URLs.

  Otherwise a sign-in comes back to localhost.

**Email for everyone:** still the Email go-live, which needs Resend, a verified sending domain and the Send Email Hook. Until then, social sign-in is the way in for everyone but the owner.

**Tests:**
- `e2e/waitlist.spec.ts` now checks that the landing page leads to `/auth`.
- Each provider's round trip is the owner's real-device check, like Google's and Facebook's: it can't run headless.
