# Mystonie brand assets

Stonie and the Mystonie wordmark, ready for slides, social posts, press, merch and partner pages. Everything here is
drawn from the app itself:
- Stonie is the mark in [`src/app/icon.svg`](../src/app/icon.svg).
- The wordmark is Bricolage Grotesque ExtraBold, converted to outlines, so no font is needed.

## What's here

| File | Use it for |
|---|---|
| `svg/mystonie-logo.svg` / `-white.svg` | The main logo, as in the app's header: Stonie with the wordmark. Ink on light backgrounds, white on dark. |
| `svg/mystonie-logo-stacked.svg` / `-white.svg` | Square-ish spaces: profile pictures with a name, posters, stickers. |
| `svg/mystonie-logo-mono-ink.svg` / `-mono-white.svg` | One colour only: print, embossing, watermarks. Stonie's face is cut out of the stone. |
| `svg/mystonie-wordmark.svg` / `-white.svg` / `-brand.svg` | The name alone, when Stonie is already nearby. |
| `svg/stonie.svg` | Stonie alone (the app icon's mark). |
| `svg/stonie-blink.svg`, `-wink.svg`, `-blush.svg`, `-wow.svg`, `-sleepy.svg`, `-love.svg` | Stonie's expressions: reactions, empty states, stickers, social posts. |
| `svg/stonie-mono-ink.svg` / `-mono-white.svg` / `-mono-brand.svg` | Stonie in one colour. |
| `svg/stonie-alive.svg` | Stonie blinking, hopping and dancing on a loop, like in the header. A self-contained animated SVG for web pages; it stays still for people who turn motion off. |
| `svg/app-icon.svg`, `-brand.svg`, `-night.svg` | Square app or avatar icons, on paper, on Mystonie orange, or on night. Platforms round the corners themselves. |
| `png/*.png` | Every SVG above as PNG, with a transparent background except the app icons. Stonie comes at 128, 512 and 1024 px; logos and wordmarks at 1200 and 2400 px wide; app icons at 180, 512 and 1024 px. |
| `png/stonie-alive.gif` | The animated Stonie as a GIF, on paper colour, for chats and email. |
| `play-store/` | The Google Play listing: icon, feature graphics, phone screenshots and the listing text, in English and Thai. See its [README](play-store/README.md). |

Prefer the SVGs: they stay sharp at any size.

## Colours

| Name | Hex | Where |
|---|---|---|
| Mystonie orange | `#cf3c12` | The brand colour: buttons, highlights. On dark backgrounds the app uses `#f47249`. |
| Ink | `#1d1713` | Text and the wordmark on light backgrounds. |
| Paper | `#fbf9f5` | The light background. |
| Night | `#161310` | The dark background. |
| White | `#f5f1ec` | The wordmark on dark backgrounds. |
| Soft orange | `#ffe8dc` | Soft tinted panels. |
| Stone | `#d3cbbf` → `#998f82` | Stonie's body (a gradient). Cheeks `#e4512c` at 45 %. |

## Type
- **Bricolage Grotesque ExtraBold:** headlines and the wordmark.
- **Geist:** body text.

Both are free on Google Fonts.

## Please
- **Clear space:** keep at least half of Stonie's width clear around the logo.
- **Minimum size:** the logo should be at least 96 px wide on screens and 20 mm in print. Stonie alone should be at least 16 px.
- **Backgrounds:** use the ink versions on light backgrounds and the white versions on dark ones. On photos, use a plain panel or the one-colour versions.
- **Don't:**
  - stretch, rotate or recolour Stonie's body;
  - add outlines or shadows;
  - retype the wordmark in another font;
  - write it with a capital M in the logo. "Mystonie" with a capital M is right in running text.

Remaking these files: the outlines, sizes and colours come from the app (`src/app/icon.svg`, `src/app/globals.css`, the
header's `src/components/logo.tsx`). See [ADR 0086](../docs/decisions/0086-stonie-alive-and-brand-kit.md).
