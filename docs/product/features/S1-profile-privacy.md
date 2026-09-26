# S1 · Profile, privacy & settings

**Stage:** 1

## Profile
`/u/[username]` shows a **card gallery** (the user's shared cards, newest first), headline stats and currently watching. It's the "collection book" others can visit.

## Privacy
- `profiles.visibility`: `public` (default, so the share loop works) or `private`.
- Private: the profile page returns "This collection is private", and card links still work for cards the user explicitly shared (a share is an explicit publish).
- Enforced with **RLS**, not only in the UI.

## Safety (public content)
- "Report" action on public profiles and shared cards (reason + optional note → `reports` table, server-only read). The owner reviews reports by email notification or a simple admin query.
- Usernames and display names pass a profanity / impersonation blocklist (reserved names such as `admin`, `mystonie`, `mysto`, `stonie`, `support`).
- Contact email for abuse is listed on the Terms page.

## Settings
- Language (`en` default, `th`), time zone, theme (system/light/dark). The saved language redirects the signed-in user to that locale.
- Profile: username, display name, avatar.
- Privacy toggle.
- Export my data (JSON) and delete my account (GDPR/PDPA/CCPA).

## Acceptance criteria
- [ ] RLS test: user B can't read user A's entries when A is private.
- [ ] Changing the language switches the UI immediately and persists to the profile.
- [ ] Export returns all of the user's entries, episode logs and cards.
- [ ] A signed-out visitor can report a public profile or card, and a reserved or blocked username is rejected.
