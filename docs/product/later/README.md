# Later: gated features

**Most of these are now approved to build before launch** ([ADR 0036](../../decisions/0036-expansion-features-before-launch.md)): they are tasks in [roadmap stage 3](../../roadmap.md#stage-3-the-community-album-before-launch), built in that order, and each task moves its spec into `product/features/`. The rest (ads, affiliate links, merch, Gems and the wheel, the AI assistant, the native app) still need the owner's go ([still gated](../../roadmap.md#still-gated-owners-go-needed)). The gates below were the old plan. They are kept as designs so nothing from the original idea is lost. Some details (e.g. Thai-market specifics, Supabase Edge Functions as the only server runtime) predate the global, solo-sized plan. Re-check them against [AGENTS.md](../../../AGENTS.md) before implementing.

| Spec | Gate (summary) |
|---|---|
| [social-feed.md](social-feed.md): follows, feed, Kudos ("Stamp") | WAU ≥ 1,000 + user demand |
| Trending from our own data, numbered "Finisher #N" stamps, friend leaderboards: **built in stage 3** as [S3 finishers & the board](../features/S3-finishers-board.md) | ≥ 200 logs/week on a popular title |
| Monthly challenges, fandom clubs: **built in stage 3** as [S3 challenges & clubs](../features/S3-challenges-clubs.md) | WAU ≥ 2,000 |
| Native app (Expo), widgets, direct IG Stories share | WAU ≥ 3,000 or web sharing friction |
| Games: **built in stage 3** as [S3 games](../features/S3-games.md) from RAWG ([ADR 0044](../../decisions/0044-games-rawg.md)); HowLongToBeat only with its permission (no scraper) | Top request in feature vote |
| Our own timestamped warnings + the quiz ([crowdsourced-warnings.md](crowdsourced-warnings.md), [quiz.md](quiz.md)): **built in stage 3** as [S3 warnings & quiz](../features/S3-warnings-quiz.md), without Gems | MAU ≥ 5,000 or DTDD data insufficient |
| Offline-first ([offline-first.md](offline-first.md)): **built in stage 3** as [S3 offline](../features/S3-offline.md) | Users complain about logging offline |
| [badges-and-shelf.md](badges-and-shelf.md) | After social feed |
| Goodreads, MyAnimeList, TV Time imports and the CSV export: **built in stage 3** as [S3 import & export](../features/S3-import-export.md) | After books/manga |
| [gem-wallet.md](gem-wallet.md), [lucky-wheel.md](lucky-wheel.md), [merch-store.md](merch-store.md) | MAU ≥ 20,000 + stable revenue |
| [native-ads.md](native-ads.md), [affiliate-links.md](affiliate-links.md) | MAU ≥ 20,000 |
| [ai-assistant.md](ai-assistant.md): help chat / natural-language search | MAU ≥ 20,000 |
| Travel module (countries visited) | Built as the Atlas (2026-10-01, [ADR 0059](../../decisions/0059-atlas.md), [spec](../features/S4-atlas.md)) |
| [long-reviews.md](long-reviews.md): long reviews, spoilers, a review feed by users (the team's Journal and short reviews on title pages are built, [S4](../features/S4-journal-reviews.md)) | ~300 short reviews a week + demand, owner's go |
