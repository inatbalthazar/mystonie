# Vision

**Mystonie** ("my stone", from *Milestone*) is **Strava for the shows and movies you finish.** Every time you finish a movie, a series or even a single episode, Mystonie turns it into **beautiful, shareable artwork with your stats**, ready for Instagram Stories, X or TikTok. Over time those cards become your personal collection. Later, Mystonie also tells you which titles contain scenes you'd rather avoid.

**Tagline:** *Finished it? Mystonie it.*

## Target users
Global TV and movie fans, roughly 16–30, who post on IG Stories, X or TikTok as a habit. Launch communities: **K-drama**, **anime** and trending **Western TV** fandoms. These are global, highly social, and have no great artwork tool.

## Positioning
Competitors are **databases with a UI** (Letterboxd: film only; Serializd, TV Time: TV tracking; MAL/AniList: anime). Mystonie is an **artwork app with a database behind it**. It wins on beauty, speed and shareability, with series/episode tracking, automatic recaps and, from stage 2, content warnings.

## Product principles
1. **One core loop:** finish → card → share. If a feature doesn't serve it, it waits.
2. **Single-player value first.** Features must be useful with zero friends on the app. Network-effect features (feed, rankings, community warnings) are gated by metrics ([roadmap](../roadmap.md#expansion-gates)).
3. **Global from day one.** English is the default. Other languages (Thai first) are optional locales. There are no region-specific core features, and dates, times and numbers follow the user's locale and time zone ([i18n](../architecture/i18n.md)).
4. **Reuse before build.** Use TMDB for titles and DoesTheDogDie for warnings, and use Supabase for the backend.
5. **Log in ≤ 3 taps. Celebrate first, ask later.**
6. **Solo-founder sized.** Minimal services, near-zero cost until revenue, and each stage has pass criteria.

## Glossary

| Term | Meaning |
|---|---|
| **Title** | A movie, series (incl. anime and K-drama), later a book or manga. Cached from TMDB (later Google Books/AniList). Table `titles`. |
| **Entry** | A user's record of a title with status `want` / `watching` / `finished`, rating, one-line review and editable `finished_at`. Table `entries`. |
| **Episode log** | A user marking one episode as watched. Table `episode_logs`. |
| **Card** | Generated share artwork (Finish, Progress, Weekly Recap, Stats Sticker, …). Rendered in the browser. |
| **Template** | A card design (Ticket, Polaroid, Bold Stats, …) defined in code + data. |
| **Recap** | An automatic weekly, monthly or yearly summary card. Weeks follow the user's local time zone. |
| **Content warning** | Stage 2: sensitive-content data (e.g. "a dog dies", "jump scares") from the DoesTheDogDie API, shown for the user's chosen avoid-topics. |
