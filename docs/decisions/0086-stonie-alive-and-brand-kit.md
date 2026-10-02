# ADR 0086: Stonie comes alive in the header, and a brand kit

**Status:** Accepted · **Date:** 2026-10-03 · Builds on [ADR 0011](0011-name-mystonie.md) (Stonie) and [ADR 0070](0070-motion-and-loading.md) (motion)

## Context
The owner (2026-10-03) asked for three things:
- Stonie in the header should dance now and then and sometimes blink.
- Its actions should be picked at random, so the top-left logo is never dull.
- The logo should be split into assets the owner can use in other work.

## Decision
**Stonie is drawn inline** (`src/components/stonie.tsx`) in place of the `<img>` of `icon.svg`. That lets its eyes, cheeks, face and body move separately. The shapes are the same as the icon's.

**Blinks:** every 2.5 to 6.5 seconds, and one in five is a double blink.

**Acts:** every 7 to 16 seconds Stonie does one act, picked at random by weight. It never repeats the act it just did. Little acts come often and the spin is rare:

| Act | What it does |
|---|---|
| hop | Crouches, springs up stretched, lands squashed, then does a smaller hop. |
| sway | A little dance from side to side on its base. |
| look | Glances left, then right. |
| wink | Winks with a bigger grin. |
| blush | Its cheeks glow and it shies away. |
| spin | Jumps and turns a full circle. |
| tilt | A curious head tilt, with its eyes up. |

A mouse over the logo makes Stonie hop.

**Where the logic lives:**
- The picking and the timing are in `src/core/stonie.ts` (pure and tested).
- The moves are CSS keyframes in `globals.css` (`.stonie[data-act]`, `[data-blink]`), using `transform-box: fill-box` so each part turns around its own centre. Hop, sway and tilt turn around the base; spin turns around the centre.

**When nothing moves:**
- With "Reduce motion" on: no timers run, and the CSS is under `prefers-reduced-motion: no-preference`. So the e2e tests, which run with reduced motion, see a still logo.
- While the tab is hidden: the timers keep running but skip their acts.

**The brand kit** is in `brand/` at the repo root. It isn't deployed. Its [README](../../brand/README.md) lists the files, colours, type and usage. It contains:
- the horizontal, stacked and one-colour logos;
- the wordmark alone, converted to outlines from Bricolage Grotesque ExtraBold (shaped with HarfBuzz at the header's −0.03em tracking), so it needs no font;
- Stonie with six more expressions (blink, wink, blush, wow, sleepy, love) and in one colour;
- three app icons;
- an animated SVG (`stonie-alive.svg`) and a GIF;
- PNGs of everything.

The kit was generated with scratch scripts outside the repo, from `src/app/icon.svg` and the theme's colours.

**Rejected:**
- **A Lottie or animation package:** ADR 0070 keeps motion in CSS. Seven keyframe sets cost a few hundred bytes.
- **Moving all the time, or on a fixed loop:** a logo that never rests pulls the eye from the page. Random gaps of 7 to 16 seconds feel alive without being busy.
- **Serving the kit from `public/`:** it would add about 5 MB to every deploy for files only the owner needs. It can move to a press page later.

## Consequences
- The header logo is now a client component. It's an inline SVG of under 2 KB with a `useId` gradient, so two logos on one page don't share ids.
- Changing Stonie means changing `src/app/icon.svg`, `src/components/stonie.tsx` and remaking the kit.
- No migration and no new package.
