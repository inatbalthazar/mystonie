# S1 · Authentication

**Stage:** 1

## Summary
Sign up and sign in with **Google** or **email** (magic link or password) through Supabase Auth. Apple sign-in becomes mandatory only if/when an iOS app ships with other social logins.

## Rules
- Supabase Auth only. No custom password storage.
- On first sign-in, a DB trigger creates `profiles` with a unique `username` (suggested from the email or display name, editable), `display_name`, `avatar_url`, `locale` (always `en` at sign-up, changed in Settings; see [i18n](../../architecture/i18n.md)) and `time_zone` (from the browser, IANA name).
- Signed-out users visiting app routes are redirected to `/auth` and then returned to where they were.
- Users can delete their account themselves (Settings), which removes their personal data (GDPR/PDPA/CCPA).

## Acceptance criteria
- [ ] Google sign-in works on desktop and in an installed PWA (iOS + Android).
- [ ] Email sign-in works, and the confirmation email is localized (en/th).
- [ ] Every `auth.users` row has a `profiles` row with `locale` and `time_zone` set.
- [ ] Account deletion removes profile, entries and episode logs.

## Data
`auth.users`, `profiles`.
