# S4 · A lively album, honestly

**Stage:** 4 (the owner, 2026-10-06) · **Built** 2026-10-06 ([ADR 0098](../../decisions/0098-a-lively-album-honestly.md))

## Summary
The album should feel busy, so people feel someone notices what they log. That never comes from fake people. Mystonie's mascot and team have accounts with a label. Stonie stamps your firsts and milestones. Your visits are counted for you, never who. An invite link brings friends in, and you follow each other.

## Behaviour
- **Labels.**
  - Stonie shows a **Mascot** label wherever its name shows: the feed, Lately, people lists and its album's cover.
  - The team's own accounts show a **Team** label.
- **Stonie.**
  - It has a page, `/u/stonie`, whose bio says it's the mascot, not a person.
  - It can't be signed in to.
  - It Stamps a finish that reaches a milestone:
    - your very first finish;
    - your first movie, series, book, manga or game;
    - your 10th, 25th, 50th, 100th, 250th, 500th and 1,000th finish.
  - Each milestone is stamped once, even if the finish is removed and added again.
  - An import gets one Stamp.
  - Lately says which milestone it was, for example:
    - "Stonie stamped your very first finish, Arrival. Welcome to the album!"
    - "Stonie stamped Dune: finish number 10 in your album!"
    - "Stonie stamped Project Hail Mary, your first book!"
  - Blocking Stonie stops it. Stonie follows nobody.
- **New members** follow Stonie and every public Team account. Find people says so ("New members follow Stonie and the team to start. Unfollow them any time."). Those follows don't tick "Follow someone" on the getting-started list.
- **Visits** (only the owner sees them):
  - "N visitors this week" under the bio on Me, with "only you see this, never who" It's hidden while there are none.
  - "Seen by N people" under each shared card on Me → Cards (all time).
  - "N readers" on each of your published articles on Me → Journal (all time).
- **Invites.**
  - Find people has **Invite friends**: "Share my invite link" opens the share sheet, or copies the link ("Link copied").
  - `/join/<username>`, for a visitor:
    - shows "Lia invited you to Mystonie", their photo and "Start your collection, free";
    - the device remembers the invite for 7 days;
    - once the new account is signed in, the two follow each other and a note says "You and Lia follow each other now."
  - For a member, the same link offers Follow. On your own link, it offers your link to share.
  - The inviter's Lately shows "Bo joined Mystonie from your invite. You follow each other now.", and they earn the **Plus One** sticker.
  - Only accounts up to two days old accept an invite, once. Official accounts don't invite.
- **The team's welcome desk**, `/admin/members` (Settings → About Mystonie → "Welcome desk (team)", `ADMIN_EMAILS` only):
  - the Team label on your own account (Show / Remove);
  - the newest public members of the last 30 days, with their latest finish, to Stamp and follow by hand from your own account.
- **Events:**
  - `invite_shared { channel, place }`;
  - `invite_accepted`;
  - `followed` with `via: "join" | "welcome"`.

## Acceptance criteria
- [x] Stonie's account exists, labelled, can't sign in, and stamps first finishes, firsts of a kind and round numbers once each, an import once, and nobody who blocked it. (`stage4_lively_album.test.sql`)
- [x] New members follow Stonie and the team; Stonie follows nobody. (`stage4_lively_album.test.sql`, `e2e/lively.spec.ts`)
- [x] Lately says which milestone Stonie stamped, with the Mascot label; people's own Stamps on the same finish read as before. (`e2e/lively.spec.ts`, `e2e/social.spec.ts`)
- [x] An invite link makes a new account and its inviter follow each other, once, and the inviter sees who joined. (`stage4_lively_album.test.sql`, `e2e/lively.spec.ts`)
- [x] Visits count once a day per visitor, never the owner, never crawlers; only the owner reads them. (`stage4_lively_album.test.sql`, `src/core/views.test.ts`, `e2e/lively.spec.ts`)
- [x] Mobile-first at 360px, light and dark; every string in `messages/`.

## Data
- `profiles.official`;
- `mascot_milestones`;
- `view_counts`, `view_marks`;
- `invites`;
- functions `official_accounts()`, `record_view()` (service role), `my_views()`, `accept_invite()`, `newest_members()` (service role), and `my_activity()` with `invite` rows;
- triggers `entries_stonie_cheers` and `profiles_welcome`.

See [data model](../../architecture/data-model.md).
