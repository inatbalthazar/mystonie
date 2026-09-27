# ADR 0013: Card system details: export library, fonts, palette, visual tests

**Status:** Accepted · **Date:** 2026-09-26

## Context
[ADR 0008](0008-client-side-card-rendering.md) settled on rendering cards in the browser. Building the v0 templates meant choosing the export library, how the Thai/Korean/Japanese fallbacks load without hurting mobile performance, how the poster palette is computed, and what "screenshot tests" check.

## Decision
- **Export with `modern-screenshot`** (`domToBlob`), not `html2canvas` (re-implements CSS layout and gets Thai shaping and modern CSS wrong) or `html-to-image` (less maintained). The card is laid out at export size (1080×1920 / 1080×1350) and only the preview is scaled with a CSS transform.
- **Noto fallbacks through `next/font/google` with `preload: false`** (KR/JP CSS now loads on demand, see [ADR 0018](0018-lazy-cjk-font-css.md)). Their `@font-face` rules keep Google's `unicode-range` slices (≈124 each for KR and JP), so the browser downloads only the slices a card's text needs, and nothing when the text is Latin. Thai uses the variable font (one file for all weights); pinned Thai weights broke the Turbopack production build on Next 16.3.6.
- **Palette computed in `src/core/cards/palette.ts`** from a 24×36 canvas sample of the w92/w342 poster: dominant 4-bit colour bucket for the background, darkened until white text reaches 7:1; most saturated common colour as the accent (≥ 3:1). No library.
- **Every TMDB image loads with `crossOrigin="anonymous"`**, including search results and chips. Otherwise the browser caches a non-CORS copy, and the same URL then fails inside a card (blank poster, tainted canvas).
- **Playwright tests assert layout, not pixels.** `/card-lab` (development only) renders every template × size × hard case. Tests check that text stays inside every clipping box, that no clamped text overflows sideways, that the Noto families load for Thai/KR/JP and not for Latin, and that exports have the right pixel size. Screenshots are attached for review. Pixel baselines differ between Windows and Linux font rendering, so they wait until the tests run in CI on one OS.

## Consequences
- `pnpm test:e2e` needs the dev server and TMDB access (for the download test). It is not in CI yet.
- Templates are v0 by agents; the designer's versions replace them without changing the registry, export or tests.
- Line-clamp ellipses may not appear in exported PNGs (the DOM shows them); text is still cut at the clamp.
