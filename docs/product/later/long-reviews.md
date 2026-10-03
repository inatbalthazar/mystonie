# Later: long reviews and a review feed by users

> **Partly built (2026-10-03, [ADR 0092](../../decisions/0092-members-write-for-the-journal.md)):** members write Journal articles (reviews, lists, guides…) with what they're about, spoilers, reports, caps on writing and the Terms' wording; the team features the best for everyone. Still waiting: comments on articles, a feed of everyone's writing, and pinning articles on profiles.

**Gate:** about 300 short reviews a week on Mystonie (the 280-character review on a finish, shown in "What people said", [ADR 0051](../../decisions/0051-journal-and-title-reviews.md)) and people asking to write more. The owner's go is needed.

## Idea
- A finish can carry a longer review (up to about 5,000 characters) with a **spoiler** switch that hides it behind "Show spoilers".
- Long reviews get their own page (`/r/<id>`) with the title card and Stamps, and show in the Following feed and in "What people said" (the first lines, then "Read more").
- A "Reviews" tab in the Feed: the most-Stamped reviews of the week from public profiles.
- Writers can pin reviews on their profile.
- Comments on Journal articles ([ADR 0052](../../decisions/0052-journal-feed.md) left them out), with the same reports, rate limit and spoiler rule.

## Needs before building
- Reports for reviews (`reports.target_kind` = `review`) and a way to hide one quickly.
- A rate limit on writing and simple spam checks (links, repeats).
- Clear terms: users own their text, Mystonie may show it.

## Why not now
On day one it would look empty, it needs moderation a solo founder can't carry yet, and it pulls Mystonie towards Letterboxd's long reviews and away from logging and cards. The team's [Journal](../features/S4-journal-reviews.md) covers reading before launch.
