# ADR 0064: Facebook sign-in, and profile photos kept in our own storage

**Status:** Accepted · **Date:** 2026-10-01 · Extends [ADR 0020](0020-auth-passwordless-ssr.md) (Google and email sign-in)

## Context
The owner asked for two things:
- Sign-up with social media, Facebook or Instagram for example, with its photo becoming the profile photo.
- A way to upload your own profile photo.

Until now:
- Google was the only social sign-in.
- The profile photo was Google's own link, copied into `profiles.avatar_url` at sign-up.
- Settings could only remove the photo.

Some facts shaped the decision:
- **Instagram can't be a sign-in.** Supabase Auth has no Instagram provider. Meta's current Instagram login (the old Basic Display API ended in December 2024) serves business and creator accounts, for apps that manage their posts, not ordinary people signing in. Instagram accounts are Meta accounts, so most people who would use Instagram can use Facebook.
- **Facebook's photo links expire.** They are signed `fbsbx.com` / `fbcdn.net` URLs. The one Supabase stores at sign-up is also tiny (50 px).
- **Google's photo links tell Google** who views a profile.

## Decision
**Facebook sign-in,** through Supabase Auth with PKCE, like Google:
- One callback serves both, `/api/auth/callback`.
- The sign-in page shows a button for each provider switched on in Supabase Auth (`/auth/v1/settings`): Google, then Facebook in its brand blue.
- We ask Facebook for `email` beyond the default `public_profile`, so the name, the email and the photo, nothing else.
- Facebook accounts without an email can't sign up. Supabase's default needs an email, and so do Mystonie's sign-in emails and account matching.
- Other providers become a line in `OAUTH_PROVIDERS` plus their setup.

**Photos live in our storage:** a public `avatars` bucket, `<user id>/<photo id>.<jpg|png|webp>`.
- **Upload in Settings:** "Add photo" or "Change photo" picks a picture.
  - A sheet frames it: drag to move it, slide to zoom, keys work too, and a round mask shows what the profile will show.
  - The browser cuts a 320 px square (EXIF rotation applied) and sends it as WebP, or JPEG where WebP can't be made, to `POST /api/account/avatar`.
- **What the server checks:** the bytes themselves must be a JPEG, PNG or WebP of at most 1 MB. SVG and anything else are refused, whatever the header says.
- **How it's stored:** the server uploads with the service role (the bucket has no client write access), points the profile at the new file and deletes the older ones.
- **Remove photo** (`DELETE /api/account/avatar`) clears the photo and deletes the files. So does account deletion.
- **At a Google or Facebook sign-in:** the callback copies the provider's photo into the bucket *after* the redirect (`after()`), so sign-in doesn't wait. It does this for a new account, or for a profile still showing a provider link from before. We ask Google for 320 px, and Facebook for 320 px with the sign-in's token. Facebook's grey silhouette means no photo.
  - A photo someone uploaded or removed is left alone.
  - When Facebook's photo can't be copied, its expiring link is dropped and the initial shows.
- `profiles.avatar_url` still holds the photo's URL, so nothing that shows avatars changed. Its check now also allows the local stack's `http://127.0.0.1:54321/storage/…` URLs.

Rejected:
- **Showing provider links as they are:** Facebook's expire, and both tell the provider who looks.
- **Resizing on the server:** that would need an image library, a new dependency ([ADR 0006](0006-single-nextjs-app.md)). The browser already draws cards ([ADR 0008](0008-client-side-card-rendering.md)), and the server only checks what it gets.
- **Letting clients upload into the bucket under a storage policy:** the server couldn't check the bytes first.

## Consequences
- Migration `20261019090000_stage4_avatars.sql` (the bucket and the relaxed check) must go on the remote project before the deploy.
- **Owner setup for Facebook,** free:
  - Create a Meta app (developers.facebook.com, use case "Authenticate and request data from users with Facebook Login", permissions `public_profile` and `email`).
  - Set the Valid OAuth Redirect URI to `https://fuhwuwhiquysbfjmgtfi.supabase.co/auth/v1/callback`.
  - Add the privacy policy URL (`https://<domain>/privacy`) and data deletion instructions (Settings → Delete account), then switch the app to Live.
  - Paste the App ID and App Secret into Supabase → Authentication → Sign In / Providers → Facebook.
  - Locally it stays off (`supabase/config.toml`, like Google).
- The Privacy policy says which provider data we take and that we keep a 320 px copy of the photo.
- `e2e/profile.spec.ts` uploads, frames, checks the stored 320 px square and removes it. The Facebook round trip can't run headless: it is the owner's real-device check, like Google's.
