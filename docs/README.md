# Mystonie docs

## Reading order (agents)
1. [product/vision.md](product/vision.md): what Mystonie is, principles, glossary. **Always read first.**
2. [roadmap.md](roadmap.md): current stage, next task, pass criteria and expansion gates.
3. The spec your task links to in [product/features/](product/features/). Files are prefixed by stage (`S0-`, `S1-`, `S2-`).
4. The relevant architecture doc:
   - [architecture/overview.md](architecture/overview.md): single Next.js app + Supabase, code layout, where logic lives, day-one rules
   - [architecture/data-model.md](architecture/data-model.md): tables by stage + RLS
   - [architecture/i18n.md](architecture/i18n.md): English-first, locales, time zones, fonts, legal
   - [architecture/external-apis.md](architecture/external-apis.md): TMDB, DTDD, Google Books, AniList, Stripe
5. [design/design-direction.md](design/design-direction.md) for any UI or card work. [product/pages.md](product/pages.md) for routes.
6. [decisions/](decisions/README.md) before changing anything they cover. Check [open-questions.md](open-questions.md) before assuming product rules.

**Don't build anything in [product/later/](product/later/README.md)** unless its gate is met and the owner says go.

## Feature index

| Stage | Spec |
|---|---|
| 0 | [S0 · Mystonie Card: card maker](product/features/S0-card-maker.md) |
| 1 | [S1 · Auth](product/features/S1-auth.md) · [S1 · Collection](product/features/S1-collections.md) · [S1 · Share artwork](product/features/S1-share-artwork.md) · [S1 · Stats](product/features/S1-stats.md) · [S1 · Profile & privacy](product/features/S1-profile-privacy.md) |
| 2 | [S2 · Content warnings (DTDD)](product/features/S2-content-warnings.md) · [S2 · Books & manga](product/features/S2-books-manga.md) · [S2 · Pro](product/features/S2-pro-subscription.md) · [S2 · Where to watch](product/features/S2-where-to-watch.md) · [S2 · Letterboxd import](product/features/S2-letterboxd-import.md) |
| Later | [Gated features](product/later/README.md) |

## Owner's brief
[brief.th.md](brief.th.md) is the owner's product brief in Thai (v4, formerly `app_idea.md`). It explains the *why*: weaknesses found, strategy, Strava lessons and cost. It's in sync with these English specs. **If they ever disagree, the English specs win for implementation. Flag the conflict to the owner.** v1 of the idea is in git history (commit `480d012`).

## Keeping docs alive
- Change behaviour → update the spec in the same PR.
- Change schema → update [data-model.md](architecture/data-model.md) with the migration.
- Choose between alternatives → add an ADR.
- Unanswered product question → add it to [open-questions.md](open-questions.md). Don't invent the answer.
