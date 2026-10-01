# ADR 0063: Stickers beyond finishes: the Reel of the Day, challenges, the quiz, writing and support

**Status:** Accepted · **Date:** 2026-10-01 · Extends [ADR 0038](0038-badges-and-shelf.md) (badges from finishes)

## Context
The owner asked for more badges:
- for people who are good at the Reel of the Day, with the last one hard to get;
- for the month's challenges;
- a supporter badge for people who buy Pro or a coffee;
- for people who do the warnings quiz;
- for people who write for the Journal.

Until now every sticker came from finishes ([ADR 0038](0038-badges-and-shelf.md)). [ADR 0043](0043-scene-warnings-and-quiz.md) had left out a "helper" sticker for the quiz, noting it could come later without schema changes. Tips go through Buy Me a Coffee, and until now we stored nothing about them ([ADR 0049](0049-revenue-plan.md)).

## Decision
**Thirteen new stickers, 35 in all.** Their rules sit in the same catalogue (`src/core/badges.ts`) and read rows that already exist. They have no title, so they show "Earned <date>" and no title name.

| Group | Stickers |
|---|---|
| Reel of the Day | Reel Rookie (first solve), One Take (solved with the first guess), Sharp Eye (10 solved in ≤ 3 guesses), Hot Streak (7 days in a row), **Reel Legend (30 days in a row)**: the hard one, with a gold rim |
| Monthly challenges | Challenger (the first), Clean Sweep (all 4 of one month), Season Pass (challenges in 6 different months) |
| Warnings quiz | Lookout (10 answers), Guardian (100). Only a yes or a no that wasn't too fast counts; "don't remember" doesn't |
| Writing | Critic (reviews on 10 finishes; an extra, since reviews are writing too), Byline (a published Journal article whose `profile` is your username; drafts never count) |
| Support | Supporter (Pro that was paid for, or a Buy Me a Coffee tip) |

**When they're awarded.** As before, the server awards them with the service role from the user's own rows, and never takes them back:
- **After a finish or a log** (`checkProgress`), which now records challenges first, so a challenge completed by the same save counts.
- **When a signed-in Reel play ends**, and **after a quiz answer that is a yes or a no**: the route checks the stickers and returns them, and the page shows the same "New sticker!" toast.
- **When the stats page renders** (quietly). That's when Pro or a published article gets noticed.

The sticker album now shows on Stats even with nothing finished, once a sticker exists.

**Tips.** We chose between:
- **The Buy Me a Coffee webhook, matched by email:** automatic, and no tip data kept.
- **Storing tips to match later:** this would keep emails of people without accounts.
- **Granting by hand only:** slow and easy to forget.

We took the webhook, with a hand route as a fallback:
- **Webhook:** `POST /api/support/webhook` checks `x-signature-sha256` (HMAC-SHA256 of the raw body under `BMC_WEBHOOK_SECRET`). On `donation.created` or `membership.started`, `award_supporter()` gives the sticker to the account signed in with `data.supporter_email`. Neither the email nor the amount is stored. Without the secret, the webhook answers 503.
- **Hand route:** `POST /api/admin/supporter { email }` (bearer `ADMIN_SECRET`) is for someone who tipped from another address and writes in.

The Terms ("Tips"), the Privacy policy and Settings say a tip with your account's email gets the sticker. A tip still unlocks no features.

## Consequences
- One function in a new migration, `20261018090000_stage4_more_badges.sql` (`award_supporter`, service role only, tested in `stage4_more_badges.test.sql`). No new tables.
- Checking stickers now reads a few more of the user's own rows: Reel plays, completed challenges, up to 100 quiz answers, up to 10 reviewed finishes, subscriptions and the username.
- The owner sets up the Buy Me a Coffee webhook: URL `https://<domain>/api/support/webhook`, with its secret in Vercel as `BMC_WEBHOOK_SECRET` (Sensitive).
- `e2e/reel.spec.ts` checks the Reel toast. `e2e/badges.spec.ts` signs its own tip, and skips unless `pnpm dev` and the test share a `BMC_WEBHOOK_SECRET`.
