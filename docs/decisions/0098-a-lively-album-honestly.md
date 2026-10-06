# ADR 0098: A lively album, honestly: Stonie's account, the team's label, visits, invites, never fake people

**Status:** Accepted · **Date:** 2026-10-06

## Context
The owner (2026-10-06) wants the app to feel busy, so people feel that someone cares about what they log. The first idea was bot accounts that look and act like real members. We don't build that:
- It deceives the people it's meant to please. In a small community it's found out fast, and the trust lost is the whole product's.
- Google Play's policies forbid deceptive behaviour, and the Android app is on its way there ([ADR 0097](0097-android-app-twa.md)).
- Fake followers and fake engagement break consumer-protection rules in several places, for example the FTC's rule on fake reviews and social-media indicators in the US.
- The privacy page and every count in the app (finishers, trending, Stamps) promise real people.

The owner agreed to the honest version and asked for all of it (2026-10-06, "ทำให้หมดเลย").

## Decision
Five parts. Each one is either a labelled official account or a real number.

1. **Official accounts carry a label.**
   - `profiles.official`: `mascot` (Stonie) or `team`. No client can write it.
   - The label shows wherever the name shows: the feed, the activity list, people lists, the album's cover (`OfficialLabel`).
   - `official_accounts()` lists them (cached for a minute per server, `src/data/official.ts`).

2. **Stonie has an account.**
   - It's a fixed auth user (`MASCOT_ID`) with no password and banned, so nobody can sign in as it. Its username `stonie` is reserved for everyone else.
   - Its bio says it's the mascot, not a person.
   - A trigger on `entries` makes it Stamp a member's first finish, their first of each kind, and their 10th, 25th, 50th, 100th, 250th, 500th and 1,000th finish. `mascot_milestones` records each one once.
   - An import gets one Stamp: the count is bounded by the next milestone.
   - Members already here have their past milestones marked as done, with no Stamps.
   - Blocking Stonie stops it.
   - The activity line says why: "Stonie stamped your very first finish, Arrival. Welcome to the album!"
   - Its Stamps count like any Stamp, since it's a real, labelled account.
   - Stonie follows nobody, so it never adds to anyone's follower count.

3. **New members follow Stonie and the team's accounts.**
   - A trigger on `profiles` does it. Find people says so, and they can unfollow.
   - Only follows people choose tick "follow someone" on the getting-started list.

4. **Visits.**
   - The owner sees "N visitors this week" on Me, "Seen by N people" under each shared card on Cards, and "N readers" on their own Journal articles.
   - A page counts after it's shown in a browser (`CountView` → `POST /api/views`), so link previews, crawlers and prefetches don't count, and neither do bot user agents.
   - Each visitor counts once a day, by a salted hash of the day and the viewer's id (or IP address and browser). The hashes are kept at most two days (`view_marks`).
   - The owner's own visits never count, nor visits across a block.
   - Only the owner reads `view_counts`; nobody sees who visited.

5. **Invites.**
   - Find people has "Invite friends": your link `/join/<username>`, shared or copied.
   - A visitor who opens it sees who invited them. The device remembers the invite for 7 days.
   - Once a new account (two days old at most) is signed in, `accept_invite()` records it once (`invites`) and the two follow each other. The new member is told so.
   - The inviter's activity says "joined Mystonie from your invite", and they earn the **Plus One** sticker.

**The team's welcome desk** is `/admin/members`, for `ADMIN_EMAILS` accounts. A team member puts the Team label on their own account, and Stamps or follows the newest members from it by hand. That's a real person reaching out, not a bot.

**Rejected:**
- **Bot accounts posing as members**, and automated Stamps or follows from anyone but the labelled mascot. Covered above.
- **Stonie following everyone:** it would add a follower that isn't a person to every count.
- **Counting visits on the server render:** prefetches and link previews would count.
- **Showing who visited:** it chills visiting, and the privacy page promises counts only.

## Consequences
- **Migration `20261027090000_stage4_lively_album.sql`:**
  - it inserts Stonie into `auth.users` and turns the profile name checks off for that one update;
  - it reads `journal_posts`, so `20261024090000_stage4_community_journal.sql` must be on the remote database first;
  - tested in `stage4_lively_album.test.sql`;
  - `stage3_social.test.sql` removes Stonie inside its transaction, so its counts stay about people.
- `e2e/lively.spec.ts` covers Stonie, an invite and a visit. `e2e/social.spec.ts` counts Stonie's follow and Stamp.
- The privacy page covers the official accounts, visits and invites (updated 2026-10-06).
- Each later official account is a team member's own account with the label on. Stonie stays the only automated one.
