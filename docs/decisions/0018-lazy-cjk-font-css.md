# ADR 0018: Load the Korean/Japanese font CSS on demand

**Status:** Accepted · **Date:** 2026-09-26

## Context
The Stage 0 spec asks for Lighthouse mobile performance ≥ 90 on the first screen. After the design pass it measured 86–88 (FCP 1.7 s, LCP 3.9 s). [ADR 0013](0013-card-rendering-details.md) loaded Noto Sans KR and JP through `next/font/google` in the root layout with `preload: false`. Their font files were never downloaded for Latin text, but their CSS was: about 250 `@font-face` rules per family, 344 KB raw in two render-blocking stylesheets on every page.

## Decision
- **Noto Sans KR/JP move to `src/cards/cjk-fonts.ts`, imported with `import()` only when a card's text contains Hangul or kana/kanji** (`ensureCardFonts` in `src/cards/fonts.ts`, which uses `scriptsIn` from `src/core/cards/text.ts`). The preview calls it for the title and review. The PNG export calls it on the card's text, forces a layout and then waits for `document.fonts.ready`. The module adds the `--font-noto-kr` / `--font-noto-jp` classes to `<html>`. Card font stacks fall back to `sans-serif` until then.
- Noto Thai stays in the layout, because its CSS is small (Thai subset only).
- **Geist Mono is removed.** Only the development-only `/card-lab` used it, and it was preloaded on every page.
- **Caveat uses one static weight (400)** instead of the variable font, because captions are regular: 48 KB instead of 73 KB.
- Rejected alternatives: keeping the CSS but inlining it (it would still weigh ~340 KB), self-hosting hand-made subsets (a new build step), and a runtime `FontFace` from Google's CDN (a third-party request that exposes visitors' IP addresses, against the [privacy approach](0015-analytics-errors-uptime.md)).

## Consequences
- The first screen ships one 50 KB stylesheet instead of four (~170 KB). Lighthouse mobile on a local production build: **94–95** on `/`, 93 on `/th` (FCP 0.8 s, LCP 3.0–3.1 s, TBT 30–100 ms, CLS 0), up from 86–88.
- In the preview, the first Korean/Japanese card is shown in the system font for a moment until the CSS arrives. The export always waits, so the PNG uses Noto.
- `e2e/cards.spec.ts` asserts that the first screen does not even declare the KR/JP families, and that `/card-lab` still loads them for Korean and Japanese text.
- The remaining LCP cost is React/Next hydration JS (~190 KB of chunks) in Lighthouse's slow-4G simulation. Lowering it further would mean removing client components from the first screen, which is not worth it now.
