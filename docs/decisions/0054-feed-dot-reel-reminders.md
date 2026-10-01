# ADR 0054: A dot on the Feed tab, and Reel of the Day reminders by push

**Status:** Accepted · **Date:** 2026-10-01

## Context
The owner (2026-10-01) asked whether the empty top-right corner (where the Next.js development badge shows on `pnpm dev`) should get a notification bell, for example to remind people to play the daily reel, or whether the nav island's tabs should get Instagram-style red dots. We compared four options:
1. A bell at the top right with an inbox.
2. Dots on several island tabs.
3. One dot on Feed, plus push reminders for the reel.
4. A bell later.

The owner chose option 3 with the recommended defaults. [ADR 0053](0053-feed-tab-stats-in-me.md) had put "a dot on Feed" off for later.

## Decision
**One coral dot on the island's Feed tab**, with no count. It means that something about you happened since you last opened the feed: a Stamp on one of your finishes, or a new follower. The feed's "Lately" list already shows these. Opening the feed clears the dot.
- **Where the times come from:**
  - Home's server render reads the newest such event (`my_activity`, limit 1) with its other data. The installed app opens on Home.
  - The feed's render says when you opened it.
- **Where it's kept:** small client components (`FeedNewsFromHome`, `FeedNewsSeen`, `src/components/social/feed-news.tsx`) keep both times in `localStorage` (`mystonie.feedNews`). The island reads them through `useSyncExternalStore` (`src/core/feed-news.ts`). The layout still reads no cookies, public pages stay static, and nothing is requested just for the dot.
  - A device or account seen for the first time starts with nothing new, so old news doesn't light it.
  - Another account signing in on the device starts over.
- **On screen:** the dot is the brand coral, not alarm red, and has a ring in the island's colour. Screen readers hear "Feed, new activity". It isn't shown while you're on the feed.
- It shows after hydration, the island being static, and stays until the feed is opened, even across reloads.

**Reel of the Day reminders by web push**, opt-in.
- **The switch:** "Reel of the Day reminders" in Settings → Notifications. It shows under the notifications switch once notifications are on, so only in the installed app (ADR 0028). It is off by default and saved as `profiles.reel_reminders` through `PATCH /api/account` (`reelReminders`).
- **Who gets one:** only on a day whose reel would end a streak of 2 or more wins. That means you won yesterday's reel with a streak of 2+ and haven't finished today's. It never comes on other days.
- **When:** the hourly job that pushes recaps (`/api/cron/weekly-recaps`, ADR 0025) also sends these, at most one a day per player, at the player's reminder hour. The reel changes at midnight UTC, so a fixed local time doesn't work everywhere. The reminder hour is the last hour of the reel's day, up to 21:00 UTC (at least 2 hours before the change), that falls between 09:00 and 21:59 on the player's clock (`isReelReminderHour` in `src/core/reel.ts`). Some examples:

  | Where | Reminder | The reel changes at |
  |---|---|---|
  | Bangkok | 21:05 | 07:00 |
  | New York, summer | 17:05 | 20:00 |
  | Auckland, summer | 10:05 the next morning | 13:00 |

  Daylight saving time comes from `Intl`.
- **Once a day:**
  - `reel_reminders_due(day, limit)` (service role) lists the players.
  - The job keeps those whose hour it is, then claims each one by setting `profiles.reel_reminded_on` to the day only where it isn't already. Only the claimed players get a push, so overlapping runs never send twice.
  - A failed push isn't retried that day.
- **The message:** "🔥 Keep your 5-day streak" and "Today's Reel of the Day ends in 9 hours. Can you name it?", in the player's language. Tapping it opens `/reel`; the push's topic is `reel-reminder`.

Rejected:
- **A bell at the top right with an inbox page.** It is out of thumb reach and scrolls away (the header isn't sticky). It would repeat "Lately" and Home's notes. A daily reel item would keep it lit, so people would learn to ignore it. It also needs a read state in the database.
- **Dots on several tabs.** Badge fatigue. A dot on Home for the reel would be lit every morning, on the page the app opens to, which already shows the reel note.
- **Keeping the seen time in the account.** The dot would follow you across devices, but it costs a write on every visit to the feed. Most people use one phone.
- **A daily "new reel" push.** It's noise. Only a streak at risk is worth interrupting someone.
- **A fixed local time for reminders.** In the Americas, 20:00 local comes after the reel has already changed.

## Consequences
- New migration `20261013090000_stage4_reel_reminders.sql`: `profiles.reel_reminders` (client-updatable), `profiles.reel_reminded_on` (server only) and `reel_reminders_due()`. It is tested in `stage4_reel_reminders.test.sql` and must be on the remote project before this code deploys.
- The cron route's answer gains `reminded`. The job looks at up to 5,000 players with a streak at risk per run and pushes to at most 500 whose hour it is. Past that scale, the hour should be filtered in SQL.
- The dot is per device. Another device shows it again until its feed is opened.
- Reminders reach installed apps only, like recap notifications. Browsers without push, and players who never turn notifications on, rely on Home's reel note.
- e2e:
  - `e2e/social.spec.ts` checks that the dot appears after a follow and a Stamp, and that the feed clears it.
  - `e2e/reel.spec.ts` checks the reminder hour, the once-a-day rule and the message, through the fake push service. It needs `CRON_SECRET` and VAPID keys.
