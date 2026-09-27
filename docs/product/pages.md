# Pages & navigation

Mobile-first. The bottom tab bar on phones is **Home · Collection · ➕ · Me**. On ≥ 1024px it becomes a side rail. Every route supports a locale prefix via next-intl (`/` = English default, `/th/...` = Thai). See [i18n](../architecture/i18n.md).

| Screen | Route | Spec | Stage |
|---|---|---|---|
| Card maker (no login) | `/` in stage 0, `/card` from stage 1 | [S0 card maker](features/S0-card-maker.md) | 0 |
| Privacy policy, Terms | `/privacy`, `/terms` | – | 0 |
| Landing (signed out) | `/` | – | 1 |
| Sign in / sign up | `/auth` | [S1 auth](features/S1-auth.md) | 1 |
| Home (signed-in landing, PWA start): date + greeting, install / notifications prompts, the week's recap note, "Up next" (next episode, one tap), recent cards (newest 6), trending (TMDB, tap → quick add) | `/home` | [S1 collections](features/S1-collections.md), [ADR 0028](../decisions/0028-home-pwa-web-push.md) | 1 |
| Search + quick add sheet | overlay (➕) | S1 collections | 1 |
| Collection: summary header, year / status filters, sort, list / posters toggle, quick add + edit sheet (`?add=1`, `&pick=<kind>:<id>` from Home's trending) | `/collection` | S1 collections | 1 |
| Title detail (my entry, episodes, cards; warnings in stage 2). Now: series only (progress, next episode, seasons, logging), signed-in | `/title/[kind]/[id]` | S1 collections, [S2 warnings](features/S2-content-warnings.md) | 1 |
| Celebration + share sheet: stamp, card, Share / Download / Change style / Sticker, optional rating + review. Also "Make a card" (edit sheet, series page) and the Progress card offer after a log | full-screen overlay after "Finished" | [S1 share artwork](features/S1-share-artwork.md) | 1 |
| Shared card (public, noindex): the card, its line, "Make your own card" CTA, OG image | `/c/[id]` | S1 share artwork | 1 |
| Weekly recap: the celebration with the week's card (from the recap email or the collection's "Your week is in" note) | `/recap/[id]` | S1 share artwork | 1 |
| Stats | `/stats` | [S1 stats](features/S1-stats.md) | 1 |
| Public profile = card gallery | `/u/[username]` | [S1 profile & privacy](features/S1-profile-privacy.md) | 1 |
| Settings (profile, privacy, language, time zone, theme, weekly recap email, recap notifications in the installed app, data export, account deletion) | `/settings` | S1 profile & privacy | 1 |
| Avoid-topics settings | `/settings/warnings` | S2 warnings | 2 |
| Pro / billing | `/pro` | [S2 Pro](features/S2-pro-subscription.md) | 2 |
| Import from Letterboxd | `/settings/import` | [S2 import](features/S2-letterboxd-import.md) | 2 |
