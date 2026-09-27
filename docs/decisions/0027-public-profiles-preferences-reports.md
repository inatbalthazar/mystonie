# ADR 0027: Public profiles, saved preferences and reports

**Status:** Accepted · **Date:** 2026-09-27

## Context
[S1 profile & privacy](../product/features/S1-profile-privacy.md) needs:
- a public page per user (`/u/[username]`) with shared cards, headline stats and what they're watching;
- a public/private switch enforced by RLS, where card links keep working for private profiles;
- settings for language, time zone and theme, where the saved language redirects the signed-in user;
- data export, a "Report" action and a username/display name blocklist.

Constraints: profiles are owner-only (time zone and locale are personal, [ADR 0020](0020-auth-passwordless-ssr.md)), public pages stay static and fast, and no new services.

## Decision
**Public profile reads go through `public.public_profile(username)`**, a security definer function that returns only the safe columns (id, username, display name, photo, join date). A private profile returns just its username and `is_private`. Entries, episode logs and shared cards are read with the visitor's own client, so RLS decides.
- Rejected: a public view of `profiles`. It would need its own grants, and it is easy to widen by accident.

**Shared cards of private profiles can no longer be listed.** The old policy let anyone read every shared card, so a private user's cards could be listed by `user_id`.
- The select policy now also needs `private.is_public_profile(user_id)`. That policy feeds the gallery.
- A card link reads through `public.shared_card(id)` (security definer). Knowing the id is the permission: sharing is an explicit publish of that one card.
- The function also returns the owner's current username when the profile is public and the card shows the name. The card page uses it to link to the profile.

**The name blocklist lives in the database**, in the `profiles_check_names` trigger (`private.is_blocked_name`, `public.is_reserved_username`).
- Clients can update their profile directly (column grants), so an app-only check could be bypassed.
- Names are folded first: lower case, digit/symbol swaps undone, only a–z and 0–9 kept.
- Blocked: route and role names; anything containing the brand (`mystonie`, `stonie`); and a short list of slurs matched inside the name.
- Short rude words that hide inside real names are matched only as the whole name. For example, "porn" is inside the Thai name "Pornchai", and "shit" is inside "Yoshitaka".
- At sign-up a blocked Google name is dropped instead of failing the sign-up. Names without Latin letters now get the username `collector` (+ digits) instead of `stonie…`, which would look official.
- `PATCH /api/account` turns the trigger's error (SQLSTATE 23514, the column in the hint) into a message.
- Rejected: a list in TypeScript as well. Two lists drift apart. Reports are the backstop for anything the list misses.

**Saved language and theme are mirrored in a preferences cookie**, `mystonie_prefs=<locale>.<theme>`, for signed-in users only.
- If the cookie is missing, the proxy reads it from the profile once per sign-in. `PATCH /api/account` rewrites it. Sign-out, account deletion and every sign-in drop it.
- The proxy sends a signed-in user's page views in another language to the saved one. Both language menus (Settings and the footer) save first, so they never fight the redirect.
- An inline script applies a saved light/dark theme before first paint (`<html data-theme>`). The dark tokens use a Tailwind variant that follows `data-theme`, or the system when there is none. The script is only in the server HTML: after hydration the component renders nothing.
- This is not the locale cookie the owner ruled out ([i18n](../architecture/i18n.md)). Visitors still get English and the URL decides for them. The cookie only mirrors a choice the user saved in their account.
- Rejected:
  - reading the profile on every request: one database round trip per page view;
  - the Supabase JWT `user_metadata`: it goes stale until the token refreshes, and it duplicates the profile;
  - rendering `data-theme` on the server: that would make every page dynamic.

**Reports** go to a server-only `reports` table through `POST /api/reports` (honeypot, rate limit of 10 an hour per IP hash).
- Only a public profile or a live shared card can be reported.
- The operator gets an email at `LEGAL.contactEmail` (Resend, or Mailpit in development). The email includes the SQL to mark the report resolved.
- Rejected: an admin page. There is one operator, so email plus a query is enough for now.

**Export** is `GET /api/account/export`: a JSON download of the account, profile, entries, episode logs, cards and weekly recaps (deleted rows included). It is read with the user's own client in pages of 1,000 rows (`collectPages`), so the API row limit never cuts it short.

**Avatar:** Settings shows the Google photo and can remove it. Uploading a photo is left for later: it needs another Storage bucket and image resizing, and no acceptance criterion asks for it.

## Consequences
- Migration `20260927150000_stage1_profile_privacy.sql` must be applied to the remote project with the other stage 1 migrations.
- A card keeps the `@username` it was made with (it is printed on the image). After a rename, the link to the profile uses the current username.
- The blocklist is English/Latin-centric. Extend `private.is_blocked_name` in a migration when reports show gaps.
- Reports have no admin screen. The operator reads them with `select * from reports where resolved_at is null order by created_at`.
