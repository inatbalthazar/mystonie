# ADR 0007: English-first global product, Thai as an optional locale

**Status:** Accepted · **Date:** 2026-09-23

## Context
The owner wants Mysto to be an international app, where even Thai users shouldn't be able to tell it's Thai-made. Earlier drafts positioned it as Thai-first.

## Decision
- English is the default language and the brand voice. **Thai** is the first optional locale, and more can be added via message files.
- **next-intl** with locale-prefixed routes (no prefix for `en`). No hard-coded UI strings.
- **English is shown by default to everyone.** The locale comes from the URL only: no `Accept-Language` redirect and no locale cookie (decided 2026-09-26). Users switch language deliberately via the language menu, and from stage 1 via their profile setting.
- No country-specific core features. Region-dependent data (where to watch) follows the user's country setting.
- Global concerns from day one: time zones, locale formatting, USD pricing via Stripe, and GDPR/CCPA/PDPA basics (privacy policy, cookieless analytics, data export and deletion).
- Launch through global fandom communities (K-drama, anime, trending TV).

## Consequences
- Every feature ships with `en` strings first. `th` translations can lag but fall back to English.
- Details: [architecture/i18n.md](../architecture/i18n.md).
