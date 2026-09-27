# ADR 0017: Design system v1 (agent-made)

**Status:** Accepted · **Date:** 2026-09-26

## Context
[ADR 0016](0016-polish-before-launch.md) moved the design pass from a freelance designer to the agent. The [design direction](../design/design-direction.md) asks for "Strava clarity × collector's scrapbook", neutral surfaces with colour from posters, one bold display face for numbers and headlines, a legible UI sans, and a Stonie mascot.

## Decision
- **Colour:** warm paper neutrals (light `#fcfaf6`, dark `#120f0c`) and **one brand colour, stamp coral** (`--brand`: light `oklch(0.57 0.19 35)` ≈ `#cf3c12`, dark `oklch(0.7 0.17 38)` ≈ `#f47249`, plus `--brand-soft` tints). Light coral was darkened from `#e4512c` because white text on it and coral text on paper must pass 4.5:1 (now 4.88 and 4.68). Primary buttons stay ink/paper; coral is for the main action (Share, Join), stars, stamps and highlights.
- **Type:** **Bricolage Grotesque** (variable, with the width axis) as the display face (`font-display`: headlines, wordmark, card titles at 87.5% width, card numbers at 75%), **Geist** stays the UI sans, **Caveat** for polaroid captions (cards only, not preloaded). Noto Thai/KR/JP remain the fallbacks behind all three. Rejected: Archivo (plainer), Unbounded (too wide for long titles), Space Grotesk (no width axis).
- **Logo:** Stonie redrawn as a warm pebble with eyes, a smile and coral cheeks (`src/app/icon.svg`), plus the lowercase `mystonie` wordmark in Bricolage ExtraBold (`src/components/logo.tsx`). The same SVG feeds the favicon, apple icon, OG image and card footers.
- **Cards v1:** a rubber **FINISHED stamp** (`FinishedStamp` in `src/cards/parts.tsx`, ink `--card-stamp`) on the Ticket perforation; hand-written date and review plus two tape strips on the Polaroid; condensed display numbers on Bold Stats; coral stars on paper stock. The v0 structure, registry, sizes and export are unchanged, so a designer can still replace templates one by one.
- **UI:** segmented pill controls, a 2xl search field with an icon, the three examples as a tilted scrapbook fan, a `brand-soft` waitlist panel with Stonie, and a site header with the logo.

## Consequences
- tailwind-merge drops a `leading-*` class that comes before a `text-[…]` size in the same `cn()`. Card code puts `leading-*` last or uses `text-[54px]/[1.15]`.
- Chrome's 1-line clamp lets Caveat's glyphs overhang by a few pixels, which fails the no-overflow test; handwritten reviews clamp at 2 lines.
- Two more font files load on the first screen (Bricolage ~77 KB preloaded, Caveat when an example has a review). Lighthouse mobile measured 82–86 locally after the change; the performance pass brought it back to 94–95 ([ADR 0018](0018-lazy-cjk-font-css.md), which also makes Caveat a single static weight).
- A maskable app icon comes with the PWA manifest (stage 1), from the same mark.
