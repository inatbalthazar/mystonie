# Design direction

UI decides whether people adopt Mystonie, and the share artwork decides whether they come back. Treat design as product, not decoration.

## Feel
- **Strava clarity × collector's scrapbook.** Big, bold numbers and clean layouts, with personality from collectible details: stamps, ticket stubs, polaroids, tape and stickers.
- **Global and brand-neutral.** Nothing should read as tied to one country. English copy is short, warm and a little playful ("Finished! 🎉", not "Saved successfully").
- **Posters are the colour.** Neutral surfaces. Cards pull their palette from the poster, so every card is unique yet on-brand.

## Foundations
- **Mobile-first:** design at 360–430px, bottom tab bar **Home · Collection · ➕ · Me**, side rail at ≥ 1024px.
- **Dark mode is first-class** (people log at night after watching). All colours are theme tokens (CSS variables / Tailwind theme, shadcn convention). No raw hex in components.
- **Typography:** one bold display face for numbers and card headlines, one highly legible UI sans, and Noto fallbacks for Thai, Korean and Japanese. Test long titles and non-Latin reviews.
- **Motion:** short, springy stamp animation on "Finished". Haptics where supported. Honour `prefers-reduced-motion`.
- **Accessibility:** WCAG 2.1 AA contrast in both themes, touch targets ≥ 44px, and warning badges never rely on colour alone.

## Card templates (stage 0)
| Template | Idea | Best for |
|---|---|---|
| **Ticket** | cinema ticket stub with perforation, seat/row replaced by stats | movies |
| **Polaroid** | poster in a polaroid frame, handwritten-style review | anything |
| **Bold Stats** | Strava-like: huge numbers, minimal poster crop | series, recaps |

Sizes: 9:16 (Stories/TikTok) and 4:5 (feed). Footer: `mystonie · @username` + short link. No QR.

## Mascot: Stonie
A small, round stone with a face, like a friendly carved milestone or stone tablet. When a user finishes a title, Stonie "carves" it into their collection (the celebration moment, alongside the FINISHED stamp). Keep it simple enough to work as a 24px icon and on cards; it never covers poster or stats. Name and meaning: [ADR 0011](../decisions/0011-name-mystonie.md).

## Deliverables from the freelance designer (one-off)
Logo + app icon (maskable) · Stonie mascot (neutral, celebrating, sleeping/empty-state poses) · colour tokens (light/dark) · type pairing · the 3 card templates in both sizes · 2 key screens (Home, Celebration) as style reference. Agents translate these into tokens and components.

## PWA
Name "Mystonie", maskable icons, per-theme `theme_color`, standalone display.
