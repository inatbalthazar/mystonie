# S1 · Profile, privacy & settings

**Stage:** 1 · **Built:** [ADR 0027](../../decisions/0027-public-profiles-preferences-reports.md)

## Profile
`/u/[username]` shows a **card gallery** (the user's shared cards, newest first, up to 30), headline stats (the all-time collection summary) and what they're watching now (up to 6 posters). It's the "collection book" others can visit.
- **The album's order** ([ADR 0069](../../decisions/0069-arrange-the-album.md)):
  - The cover and the all-time numbers stay on top.
  - The other sections follow in the owner's order, minus the ones they hid. The default order: Card gallery, Right now, The shelf, Stickers, Atlas, Challenge patches, Clubs, Saved to read (owner only).
  - Long sections show two rows and "Show all (N)": 4 cards on phones (6 from 640 px), two shelves. Right now scrolls sideways on phones.
  - On Me, "Arrange" opens a sheet where the owner moves sections by a drag handle or arrows and hides them with an eye. The Atlas's eye is "Show my Atlas on my profile".
  - Hiding takes a section off the album; it doesn't make anything private.
  - Visitors see the album as arranged.
- The page reads a safe subset of the profile through `public_profile()` (name, photo, join date, never locale or time zone). Everything else is read with the visitor's own client, so RLS decides.
- Signed-out visitors also get a "Start your own collection" call to action. The owner doesn't see the Report button on their own page.
- Not indexed by search engines (`noindex, follow`), like card pages.
- The shared card page (`/c/[id]`) links "From @name's collection" to the profile when it is public.

## Privacy
- `profiles.visibility`: `public` (default, so the share loop works) or `private`.
- Private: the profile page returns "This collection is private" (the owner also sees a note linking to Settings). Card links still work for cards the user explicitly shared (a share is an explicit publish), but they no longer link to the profile.
- Enforced with **RLS**, not only in the UI. Entries, episode logs and the gallery need a public profile. A private user's shared cards can't be listed, only opened by id (`shared_card()`).

## Safety (public content)
- "Report" action on public profiles and shared cards: reason (spam, harassment, hate, sexual content, impersonation, other) + optional note (≤ 500 characters) → `POST /api/reports` → `reports` table (server-only read). No account needed. There is a honeypot and a limit of 10 an hour per IP hash, and only public profiles and live shared cards can be reported.
- The owner gets an email for each report (to the legal contact address; Mailpit in development) with the SQL to resolve it. Open reports: `select * from reports where resolved_at is null order by created_at`.
- Usernames and display names pass a profanity / impersonation blocklist in the database, which checks every client write. It covers reserved route and role names such as `admin`, `support`, `settings`, `mysto`, and any name containing `mystonie` or `stonie`, also with digit swaps like `st0nie`. A blocked Google name is dropped at sign-up.
- Contact email for abuse is listed on the Terms page.

## Settings
- Language (`en` default, `th`), time zone (IANA list, plus "use this device's time zone"), theme (system/light/dark). Each saves as soon as it changes.
  - The saved language redirects the signed-in user to that locale, and the footer language menu (signed out only since [ADR 0065](../../decisions/0065-app-footer.md)) saves it too.
  - A saved light/dark theme applies before first paint on every page.
  - Both work through the `mystonie_prefs` cookie, which exists only while signed in.
- Profile: display name, username (with a link to the public page), bio (plain text, ≤ 160 characters and 4 lines, shown under the name on the public page; links aren't linked, [ADR 0057](../../decisions/0057-profile-bio.md)), photo (the Google photo can be removed; uploading a photo comes later).
- Privacy toggle ("Public collection").
- Content warnings (stage 2): how many topics are chosen, and a link to `/settings/warnings` ([S2 content warnings](S2-content-warnings.md)).
- Export my data (JSON download: account, profile, entries, episode logs, reading logs, cards, weekly recaps, subscriptions, avoid-topics, and from stage 3 follows, Stamps, blocks, badges, each entry's finisher number, challenge joins and club memberships; deleted rows included), Export as CSV (stage 3: the live collection, episodes and reading logs as spreadsheets that import back, [S3 import & export](S3-import-export.md)) and delete my account (GDPR/PDPA/CCPA).

## Acceptance criteria
- [x] RLS test: user B can't read user A's entries when A is private. (`supabase/tests/database/stage1_collection.test.sql`)
- [x] Changing the language switches the UI immediately and persists to the profile. (`e2e/profile.spec.ts`)
- [x] Export returns all of the user's entries, episode logs and cards. (`e2e/profile.spec.ts`; paging in `src/core/account.test.ts`)
- [x] The bio is tidied and limited, shown on the public page as plain text, and hidden while private. (`src/core/account.test.ts`, `stage4_profile_bio.test.sql`, `e2e/profile.spec.ts`)
- [x] A signed-out visitor can report a public profile or card, and a reserved or blocked username is rejected. (`e2e/profile.spec.ts`, `supabase/tests/database/stage1_profile_privacy.test.sql`)
