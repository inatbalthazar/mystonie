# ADR 0020: Passwordless sign-in with cookie sessions, and auth emails from our app

**Status:** Accepted · **Date:** 2026-09-27

## Context
Stage 1 needs accounts ([S1 auth](../product/features/S1-auth.md)). The requirements:
- Google and email sign-in through Supabase Auth (Facebook too since [ADR 0064](0064-facebook-sign-in-and-photos.md)).
- A localized (en/th) confirmation email.
- Sign-in that works in an installed PWA.
- A `profiles` row with locale and time zone for every user.
- Protected app pages.
- Self-service account deletion.

Several choices were open. The spec allowed a magic link or a password. It didn't say how the session reaches server components, and it didn't say how auth email gets localized, because Supabase has one template per email type and no locale.

## Decision
**Email sign-in is passwordless: one email carries a 6-digit code and a link.** No passwords.
- The code is typed on the sign-in page. That is the path that works in an installed PWA: on iOS, a tapped email link opens Safari, which has separate storage from the home-screen app.
- The link is for people reading the email on the same device.
- Rejected, **passwords:** they bring reset flows and weak or reused passwords, and add nothing to a Google-or-email app.
- Rejected, **magic link only:** it breaks in the PWA.
- The link opens our confirm page (`/[locale]/auth/confirm`). Signing in takes a tap there, which is a POST to `/api/auth/confirm` running `verifyOtp` with the token hash. Mail scanners open links, and a GET that signs in would use up the one-time token before the person clicks.
- New and returning people take the same path (`shouldCreateUser`).

**Google uses OAuth with PKCE.** It returns to `GET /api/auth/callback`, which exchanges the code for a session.
- The button only shows when Google is enabled in Supabase Auth (read from `/auth/v1/settings`).

**Sessions live in cookies through `@supabase/ssr`**, the one new package (Supabase's official SSR helper). With cookies, server components, route handlers and the proxy all see the same session. Local storage would hide it from the server.
- The browser client (`src/lib/supabase-browser.ts`) is used only on the sign-in page, which keeps supabase-js out of other pages' bundles.
- Server code uses `userClient()` (`src/data/supabase-server.ts`), where RLS applies.

**The proxy (`src/proxy.ts`) refreshes the session and guards pages:**
- It runs only when an `sb-…-auth-token` cookie is present or the path is protected, so signed-out visitors on public pages pay nothing and those pages stay static.
- Protected paths (`PROTECTED_PATHS` in `src/core/auth.ts`) redirect signed-out visitors to `/[locale]/auth?next=<path>`. Every `next` passes `safeNextPath`, so it can't be used as an open redirect.
- The header's "Sign in" / "Your account" link reads the cookie in the browser, so the layout stays static.

**Auth emails go through Supabase's Send Email Hook to our route**, not through SMTP:
- Supabase signs each request (Standard Webhooks, `SEND_EMAIL_HOOK_SECRET`), and `POST /api/auth/email-hook` verifies it in `src/core/email/webhook.ts`.
- The route renders the email from `messages/*.json` (`Emails.signIn`) and sends it with Resend's API (`sendEmail`).
- The language comes from the page the person signed in on (the locale prefix of the confirm-page redirect), then their sign-up locale, then `en`.
- This **replaces the "Resend SMTP for Supabase Auth" part of [ADR 0019](0019-email-resend.md)**. SMTP can't pick a template per locale, and the hook keeps all email copy in one place and one visual frame (`src/core/email/layout.ts`).
- In development without `RESEND_API_KEY`, the route delivers to the local Mailpit through its HTTP API, so sign-in works offline and never reaches real inboxes.

**Profiles are created by an `after insert` trigger on `auth.users`**, `handle_new_user`:
- The username comes from the Google name, else from the email local part, with the `+tag` dropped. The rules are `[a-z0-9_]{3,20}`, not on the reserved list, and 4 digits are added when taken. Scripts without Latin letters fall back to `stonie` plus digits.
- The locale and time zone come from `signup_locale` and `signup_time_zone` in the sign-up metadata.
- OAuth can't carry metadata, so the callback sets both on a profile created in the last 10 minutes, using `next` and `tz`.
- Profiles are readable by their owner only, because time zone and locale are personal. Public profile pages will read a safe subset through the server (profile task).

**The locale at sign-up is the page's locale.** The spec said "always `en` at sign-up". But the locale in the URL is one the person chose themselves (English-default decision, 2026-09-26: no detection from the browser), so it is kept rather than reset to English.

**Account deletion** runs through `DELETE /api/account`:
- The route checks the session with `getUser()`, revokes all of the user's sessions, then deletes the user through the service role.
- `profiles` cascades from `auth.users`, and every user table added later must reference `profiles(id)` or `auth.users(id)` with `on delete cascade`.
- A waitlist row with the same email is deleted too.

## Consequences
- **Owner setup in the Supabase dashboard (production):**
  - Authentication → URL Configuration: Site URL = the production origin, plus redirect URLs `https://<domain>/**` and the Vercel URL.
  - Authentication → Hooks: add a Send Email hook (HTTPS) to `https://<domain>/api/auth/email-hook`, and put the generated secret in Vercel as `SEND_EMAIL_HOOK_SECRET`.
  - Authentication → Sign In / Providers → Google: add the client ID and secret from a Google Cloud OAuth client (redirect URI `https://fuhwuwhiquysbfjmgtfi.supabase.co/auth/v1/callback`).
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set in Vercel.
  - SMTP settings are no longer needed for auth.
- **Local development:**
  - `supabase/config.toml` enables the hook at `http://host.docker.internal:3000/api/auth/email-hook` with a local-only secret, which `.env.local` repeats. Sign-in emails therefore need `pnpm dev` on port 3000, and they land in Mailpit.
  - Google stays off locally unless a developer adds their own OAuth client.
- If the hook fails (the app is down, or Resend is down), sign-in by email fails with an error, and Google still works. Sign-in emails count toward Resend's 100/day free limit, which is shared with the launch email: take Resend Pro for launch month.
- The sign-in email is transactional, so it has no unsubscribe link.
- Apple sign-in waits for an iOS app (spec).
