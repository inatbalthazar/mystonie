# Later: gated features

**Do not build these until their gate in the [roadmap](../../roadmap.md#expansion-gates) is met and the owner says go.** They are kept as designs so nothing from the original idea is lost. Some details (e.g. Thai-market specifics, Supabase Edge Functions as the only server runtime) predate the global, solo-sized plan. Re-check them against [AGENTS.md](../../../AGENTS.md) before implementing.

| Spec | Gate (summary) |
|---|---|
| [social-feed.md](social-feed.md): follows, feed, Kudos ("Stamp") | WAU ≥ 1,000 + user demand |
| Trending from our own data, numbered "Finisher #N" stamps, friend leaderboards | ≥ 200 logs/week on a popular title |
| Monthly challenges, fandom clubs | WAU ≥ 2,000 |
| Native app (Expo), widgets, direct IG Stories share | WAU ≥ 3,000 or web sharing friction |
| Games (RAWG + HowLongToBeat via cached server job, see [ADR 0005](../../decisions/0005-hltb-via-edge-function-cache.md)) | Top request in feature vote |
| [crowdsourced-warnings.md](crowdsourced-warnings.md) + [quiz.md](quiz.md): our own timestamped warnings + quiz | MAU ≥ 5,000 or DTDD data insufficient |
| [offline-first.md](offline-first.md) | Users complain about logging offline |
| [badges-and-shelf.md](badges-and-shelf.md) | After social feed |
| [import-export-full.md](import-export-full.md): Goodreads, MAL, TV Time | After books/manga |
| [gem-wallet.md](gem-wallet.md), [lucky-wheel.md](lucky-wheel.md), [merch-store.md](merch-store.md) | MAU ≥ 20,000 + stable revenue |
| [native-ads.md](native-ads.md), [affiliate-links.md](affiliate-links.md) | MAU ≥ 20,000 |
| [ai-assistant.md](ai-assistant.md): help chat / natural-language search | MAU ≥ 20,000 |
| Travel module (countries visited) | Owner decision, not core |
