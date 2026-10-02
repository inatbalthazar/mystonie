# S1 · Authentication

**Stage:** 1 · **Decisions:** [ADR 0020](../../decisions/0020-auth-passwordless-ssr.md), [ADR 0064](../../decisions/0064-facebook-sign-in-and-photos.md), [ADR 0071](../../decisions/0071-sign-up-and-more-providers.md)

## Summary
Sign up and sign in with **Google**, **Apple**, **Facebook** ([ADR 0064](../../decisions/0064-facebook-sign-in-and-photos.md)), **X**, **Discord** ([ADR 0071](../../decisions/0071-sign-up-and-more-providers.md)) or **email** through Supabase Auth. Instagram can't be a sign-in (no provider for people's accounts). Email is passwordless: one email carries a code (typed in the app, which also works in an installed PWA) and a link for the same device. Sign-up and sign-in are the same step. Apple sign-in costs the Apple Developer Program (99 USD a year), so it stays off until the owner chooses to pay; it becomes mandatory if an iOS app ships with other social logins.

## Rules
- Supabase Auth only. No passwords at all (so no custom password storage and no reset flow).
- On first sign-in, a DB trigger creates `profiles` with:
  - a unique `username`, suggested from the Google name or the email local part (editable later in the profile task);
  - `display_name` and `avatar_url` (from the social account; Apple gives no photo; right after sign-in the photo is copied into our `avatars` bucket at 320 px, [ADR 0064](../../decisions/0064-facebook-sign-in-and-photos.md));
  - `locale`: the locale of the page the person signed up on. That is `en` unless they chose another language in the URL; there is no browser detection ([i18n](../../architecture/i18n.md)). Changed in Settings;
  - `time_zone`: from the browser, as an IANA name. An unknown value becomes `UTC`.
- Signed-out users visiting app routes (`PROTECTED_PATHS` in `src/core/auth.ts`) are redirected to `/auth?next=<path>` and returned there after signing in. Without a `next`, sign-in lands on Home (`/home`, [ADR 0028](../../decisions/0028-home-pwa-web-push.md)). A signed-in user who opens `/auth` goes straight to `next`.
- The sign-in email is sent in the language of the page the person signed in on, falling back to their sign-up locale.
- The email link opens a confirm page. Signing in needs a tap there, because mail scanners open links.
- Users can delete their account themselves (Settings), which removes their personal data (GDPR/PDPA/CCPA): the auth user, their profile, everything cascading from it, and a waitlist row with the same email.

## Screens
- `/auth`: title, Google, Apple, Facebook, X and Discord buttons in that order (each only when the provider is enabled), email → "Email me a code" → code field with "Send a new code" / "Use a different email", and the Terms/Privacy notice.
- `/auth/confirm`: "Sign me in" button for the email link.
- `/settings` (protected): username, email, sign-in method, language, time zone, Sign out, and Delete account (two taps).
- Header: "Sign in", or "Your account" when a session cookie exists.
- Landing page (signed out): "Start your collection, free" under the hero, and a sign-up box under the card maker and after a card is shared or downloaded, all to `/auth` ([ADR 0071](../../decisions/0071-sign-up-and-more-providers.md)).

## Acceptance criteria
- [ ] Google sign-in works on desktop and in an installed PWA (iOS + Android). *Code done (PKCE + `/api/auth/callback`). It needs the owner's Google OAuth client and a real-device check (roadmap 🧑 Auth go-live).*
- [ ] Facebook sign-in works on a phone and brings the photo. *Code done; needs the owner's Meta app (roadmap 🧑 Facebook sign-in go-live).*
- [ ] X and Discord sign-in work on a phone and bring the photo; Apple when the owner pays for it. *Code done; needs the owner's apps (roadmap 🧑 More sign-ins go-live).*
- [x] A visitor finds sign-up from the landing page. (`e2e/waitlist.spec.ts`.)
- [x] Email sign-in works, and the confirmation email is localized (en/th). (`e2e/auth.spec.ts`: code flow in English, link flow in Thai.)
- [x] Every `auth.users` row has a `profiles` row with `locale` and `time_zone` set. (pgTAP `stage1_auth.test.sql`.)
- [x] Account deletion removes the profile, entries, episode logs and cards (e2e + pgTAP `stage1_auth` / `stage1_collection`).

## Data
`auth.users`, `profiles`, `waitlist` (cleanup on deletion).
