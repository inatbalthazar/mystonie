# ADR 0008: Render share cards in the browser

**Status:** Accepted · **Date:** 2026-09-23

## Context
Share cards are the core of the product. They contain user text in any script (Thai, Korean, Japanese reviews). Server-side JSX-to-image tools such as Satori / `@vercel/og` don't do full complex-text shaping, so Thai vowel and tone marks and some other scripts can render incorrectly. Server rendering with headless Chromium is heavy for a solo setup.

## Decision
- Cards are React components rendered in the browser and exported to PNG with a DOM-to-image library (e.g. `modern-screenshot`). The browser handles fonts and text shaping correctly.
- Fonts are self-hosted and preloaded before export: brand fonts + Noto Sans Thai/KR/JP.
- The exported PNG is uploaded to Supabase Storage when shared (for the `/c/[id]` page and gallery).
- `@vercel/og` is used only for link-preview images whose content is Latin-safe, or the preview serves the stored PNG directly.

## Consequences
- No server rendering cost, and previews are instant when switching templates.
- Weekly recaps are rendered when the user opens them (or on first view of the notification link), not in bulk on a server. Revisit when bulk rendering is needed (Chromium/Skia worker, Remotion for video).
- Verify export quality across iOS Safari, Android Chrome and desktop in stage 0.
- Rendering is async, but iOS Safari only allows `navigator.share` directly inside the user's tap. So the PNG is pre-rendered whenever the preview settles and the Share handler uses the ready `Blob` (details in the [S0 spec](../product/features/S0-card-maker.md)).
- Large CJK fonts are loaded only when the card text needs them, to keep mobile performance ≥ 90.
