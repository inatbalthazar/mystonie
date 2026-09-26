# Pages & navigation

Mobile-first. The bottom tab bar on phones is **Home · Collection · ➕ · Me**. On ≥ 1024px it becomes a side rail. Every route supports a locale prefix via next-intl (`/` = English default, `/th/...` = Thai). See [i18n](../architecture/i18n.md).

| Screen | Route | Spec | Stage |
|---|---|---|---|
| Card maker (no login) | `/` in stage 0, `/card` from stage 1 | [S0 card maker](features/S0-card-maker.md) | 0 |
| Privacy policy, Terms | `/privacy`, `/terms` | – | 0 |
| Landing (signed out) | `/` | – | 1 |
| Sign in / sign up | `/auth` | [S1 auth](features/S1-auth.md) | 1 |
| Home: "Next episode" shortcuts, recent cards, trending (TMDB) | `/home` | [S1 collections](features/S1-collections.md) | 1 |
| Search + quick add sheet | overlay (➕) | S1 collections | 1 |
| Collection (tiles / list toggle, status filter) | `/collection` | S1 collections | 1 |
| Title detail (my entry, episodes, cards; warnings in stage 2) | `/title/[kind]/[id]` | S1 collections, [S2 warnings](features/S2-content-warnings.md) | 1 |
| Celebration + share sheet | overlay after "Finished" | [S1 share artwork](features/S1-share-artwork.md) | 1 |
| Stats | `/stats` | [S1 stats](features/S1-stats.md) | 1 |
| Public profile = card gallery | `/u/[username]` | [S1 profile & privacy](features/S1-profile-privacy.md) | 1 |
| Settings (language, time zone, privacy, account deletion) | `/settings` | S1 profile & privacy | 1 |
| Avoid-topics settings | `/settings/warnings` | S2 warnings | 2 |
| Pro / billing | `/pro` | [S2 Pro](features/S2-pro-subscription.md) | 2 |
| Import from Letterboxd | `/settings/import` | [S2 import](features/S2-letterboxd-import.md) | 2 |
