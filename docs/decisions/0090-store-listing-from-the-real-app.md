# ADR 0090: The store listing shows the real app

**Status:** Accepted · **Date:** 2026-10-03 · Follows [ADR 0089](0089-landing-tour.md) (the landing tour) and [ADR 0086](0086-stonie-alive-and-brand-kit.md) (the brand kit)

## Context
The owner (2026-10-03) asked for pictures for Mystonie's Google Play listing and a short description of the app, in English and Thai. The pictures go in `brand/`. Where making them was hard, prompts for another AI would do.

Play's listing takes:
- an icon;
- a feature graphic (1024 × 500);
- up to eight phone screenshots (9:16, at least 1080 px for Play to promote the app);
- a name (30 characters), a short description (80) and a full description (4,000), each translatable.

Play asks that screenshots show the app as people will use it.

## Decision
**Every picture is the real app.** No drawn or AI-made screens. That also rules out the prompts for another AI.

**The screens come from a demo world:**
- A script seeds the local Supabase stack through the app's own API: Maya's year of finishes across all five kinds and four friends who follow and stamp her.
- Because the app makes the data itself, the stickers, rare finishes, stats, Atlas and feed come out as they would for anyone.
- Playwright then captures a production build at 412 × 892, 3×, in English and Thai, light and dark. The account's language is switched for Thai, because the app follows it.

**The screenshots are album pages.** Each one has:
- the landing tour's heading (ADR 0089);
- the screen in a phone taped onto paper, soft orange or night;
- a pen note with an arrow, or real stickers peeled off around it.

The order puts the idea first: the card, the collection, the numbers. Then the friends, the episodes, the Atlas, the stickers and the warnings.

**The feature graphic** has:
- the logo and the brand line, "Finished it? Mystonie it.";
- five real card exports, one per kind and each in its own style;
- the FINISHED stamp, as on the landing page.

**The listing text:**
- It names only what the app does today. Pro is left out because it isn't on sale.
- It gives TMDB's attribution.
- It names the import sources once.
- It never compares Mystonie to another brand, which rules out "Strava for…".

**It all lives together:**
- the assets and the text in `brand/play-store/`;
- the scripts in `scripts/store/` (seed, capture, compose). One command remakes it all when the app changes. The scripts refuse any Supabase but the local stack.

**Rejected:**
- **Mockups of the landing tour's pictures:** pretty, but not the app.
- **Asking another AI for screens:** it would make up a UI.
- **Bare screenshots without a frame:** they're accurate, but don't say what each one is for.

## Consequences
- The pictures fall behind when the app changes. Rerun `node scripts/store/make.mjs`, as `brand/play-store/README.md` says.
- The demo accounts (`store-*@example.com`) stay in the local database between runs. Each run replaces them.
- Capturing them found that cards from the collection lost their poster ([ADR 0091](0091-card-posters-own-url.md)).
