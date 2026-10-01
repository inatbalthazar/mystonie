# ADR 0067: Rare finishes instead of finisher numbers

**Status:** Accepted · **Date:** 2026-10-02 · Changes what [ADR 0039](0039-finishers-trending-board.md) shows; keeps its numbering

## Context
Every finish got a number ("Finisher #224", [ADR 0039](0039-finishers-trending-board.md)). The number showed on:
- the card's seal;
- the celebration;
- the title page;
- the feed.

The owner (2026-10-02) said finishing isn't a competition. They asked to show, instead, the share of people who had finished the title when you did, e.g. "0.01%".

A number ranks people: #224 tells you 223 people got there first. A share tells you how rare the finish is, like trophy rarity in PlayStation, Steam or Xbox ("0.4% of players"). That celebrates a rare taste or a long haul, not arriving early.

Two traps:
- **A share is noise while Mystonie is small.** With 40 members, one finish is "2.5%", and the very first member's first finish is "100%". Tiny counts also hint at who watched what.
- **A share of a hit isn't worth stamping.** "48% of Mystonie finished this" on a share card reads as ordinary, not a feat.

## Decision
**What the share is:** finishers of the title out of all of Mystonie's members (profiles), with this person included.
- It is taken at their **first** finish of the title and kept for good, like the number was. A shared card never changes later.
- The database records it next to the number: `title_finishers.share` and `members`, copied to `entries.finish_share` and `finish_members` by the existing `entries` trigger. Nobody can set them.
- Existing finishes were backfilled:
  - The member count is the members who had joined by the time the number was handed out.
  - The finisher count is how many of the title's numbered finishers, up to theirs, still have an account.

**When it shows:** only once the finish was taken with Mystonie at **1,000 members** or more (`SHARE_MIN_MEMBERS`). Then the smallest share is 0.1%, and 0.01% needs 10,000 members. Before that:
- no share shows anywhere;
- the title page shows the plain count and says the share comes at 1,000 members.

**A rare finish is 10% or less** (`RARE_SHARE`). Where the share shows:
- **Finish card:** the round seal "RARE FINISH · 0.4% · OF MYSTONIE", only when rare. "Hide on card" calls it "Rare finish".
- **Celebration:** the share for every finish.
  - Rare: "A rare finish: only 0.4% of Mystonie has finished this".
  - Otherwise: "48% of Mystonie has finished this".
- **Feed:** a "Rare finish · 0.4%" tag, only when rare.
- **Title page:**
  - the title's share now ("That's 3.2% of everyone on Mystonie"), from `public.member_count()`;
  - "You finished it.";
  - the people you follow who finished it, newest first, with no numbers.

**How a share is printed (`shareFormat`):**

| Share | Printed as |
|---|---|
| 10% and up | whole percents |
| 1% to 10% | one decimal |
| below 1% | one significant digit ("0.4%", "0.03%") |
| below 0.01% | "<0.01%" |

A share never rounds to 0%.

**The numbering stays.** `title_finish_counts` gives the finisher count, and the race-free ledger is what each share is counted from. The data export still has `finisher_no`, next to the share.

Rejected:
- **"Top 0.4%" or "among the first X%":** that's still a race, and nobody knows how many will finish later.
- **A live share on cards:** cards would change after sharing, and the celebration's moment would be lost.
- **Counting only people who log that kind (movies or books):** fairer in theory, but harder to explain and to count.
- **Showing shares from the start:** see the traps above.

## Consequences
**New code:**
- `src/core/finish-share.ts` (`shownShare`, `liveShare`, `isRare`, `shareFormat`), with tests.
- `src/lib/share.ts` `formatShare`.
- `CardData.finishShare` replaces `finisherNo`. Cards saved before keep their `finisherNo` in their params, ignored.

**Migration `20261020090000_stage4_finish_share.sql`:**
- the new columns and their backfill;
- `member_count()`;
- `following_feed`, `club_feed` and `title_reviews` return `finish_share` and `finish_members` in place of `finisher_no`.

It must go on the remote project before the deploy.

**Cost:** a first finish now costs two counts (the title's ledger and all profiles), once per person and title.

**Tests:**
- pgTAP: `stage4_finish_share.test.sql`, plus the feed check in `stage3_finishers.test.sql`.
- `e2e/finishers.spec.ts` checks the share, or its absence, depending on how many members the database has. It also checks that no "#N" is shown anywhere.

The Privacy Policy now speaks of the share, not the number.
