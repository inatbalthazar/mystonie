# Design direction

UI decides whether people adopt Mystonie, and the share artwork decides whether they come back. Treat design as product, not decoration.

## Feel
- **Strava clarity × collector's scrapbook.** Big, bold numbers and clean layouts, with personality from collectible details: stamps, ticket stubs, polaroids, tape and stickers.
- **Global and brand-neutral.** Nothing should read as tied to one country. English copy is short, warm and a little playful ("Finished! 🎉", not "Saved successfully").
- **Posters are the colour.** Neutral surfaces. Cards pull their palette from the poster, so every card is unique yet on-brand. A poster in a window wider than itself (Ticket, Polaroid's feed size) is cropped toward its top, 10% down, not its centre: faces sit in a poster's upper third, so a centred crop cut heads off (2026-10-02).

## Foundations
- **Mobile-first, above everything else** ([ADR 0050](../decisions/0050-mobile-first-nav-island.md)): people use Mystonie on their phones, even though it's a website. Design at 360–430px first; tablets and desktops get the same single column, centred. The installed app (PWA) is the best home for it.
- **The nav island:** signed in, a paper pill floats above the bottom edge on every page and at every width: **Home · Collection · ➕ · Feed · Me** ([ADR 0053](../decisions/0053-feed-tab-stats-in-me.md)). It has a hairline ring, a soft shadow and a strip of coral tape holding it to the page, and the page fades out behind it. On phones the tabs are icons only; from 640px their names show under them. The tab you're on gets a heavier icon and a coral tape strip under it. ➕ in the middle is a coral rubber stamp (quick add). Me is your own album, with Settings on it and two divider tabs under its cover: Album and Stats. Feed stays lit on the community pages and the Journal's articles, which the feed lists ([ADR 0062](../decisions/0062-journal-in-the-feed.md)). Something new about you (a Stamp, a follower) puts a small coral dot on Feed's icon: brand coral with a ring in the island's colour, never alarm red, never a count, and on no other tab ([ADR 0054](../decisions/0054-feed-dot-reel-reminders.md)). The header keeps only the logo (plus Sign in when signed out); on a page under a tab the logo makes way for an iOS-style back button, a coral chevron and the name of the page before, "‹ Atlas" ([ADR 0061](../decisions/0061-back-button.md)). Pages don't add their own back links.
- **Dark mode is first-class** (people log at night after watching). All colours are theme tokens (CSS variables / Tailwind theme, shadcn convention). No raw hex in components.
- **Typography:** one bold display face for numbers and card headlines, one highly legible UI sans, and Noto fallbacks for Thai, Korean and Japanese. Test long titles and non-Latin reviews.
- **Motion** ([ADR 0070](../decisions/0070-motion-and-loading.md)): Threads' feel, the scrapbook's look. Quick, springy and small, with the curves and animations in `globals.css` ("Motion"). Pages slide the way you go (forward left, back right, a page's tabs sideways, the island's tabs crossfade) while the header and the island stay put. Sheets rise and drag away. Buttons give under the finger (`press`), lists settle in (`stagger`), big numbers count up, an icon pops as it turns on. A light vibration where supported, the springy FINISHED stamp on a finish. `prefers-reduced-motion` turns all of it into instant changes. Nothing is slowed down to show an animation.
- **Buttons:** pills (`rounded-full`) with `press`. Coral for a screen's main action, an outline (`ring-1 ring-border`) for the rest. `h-14` for the one big action of a sheet, `h-12` for a screen's main action, `h-11` otherwise. A card or list row that is a button keeps its own shape.
- **Accessibility:** WCAG 2.1 AA contrast in both themes, touch targets ≥ 44px, and warning badges never rely on colour alone.

## Mobile checklist (every page, every change)
- **Thumb first:** the main action of a screen sits in the lower half or in a bottom sheet (`Sheet`), never only in a top corner. Pickers and forms open as bottom sheets on phones.
- **The island's room:** every page still works with the nav island over its last 5rem. Anything fixed or sticky at the bottom sits above it with `--island-space` (see the sticker toast and the import bar).
- **Short pages:** a grid or list that keeps growing (stickers, milestones) shows two rows, the best first, then "Show all (N)" (`ShowAll` and `previewClass` in `src/components/show-all.tsx`).
- **Safe areas:** the page runs edge to edge (`viewport-fit=cover`), so anything fixed to an edge pads with `env(safe-area-inset-*)`.
- **Touch:** targets ≥ 44px and apart, visible `:active` feedback, nothing that needs hover, swipe only as a shortcut for a visible button.
- **Typing:** text fields are 16px or larger (iOS zooms into smaller ones), with the right `type`, `inputMode`, `autoComplete` and `enterKeyHint`. The island hides while one has focus on a touch screen.
- **Check:** screenshots at 360px in light and dark (and Thai for long words), e2e on a phone (Playwright runs as a Pixel 7), and the owner's real-device pass on iPhone Safari and Android Chrome, in the browser and installed.
- **Speed:** Lighthouse mobile ≥ 90, images sized for a phone, no layout shift when data arrives.
- **Waiting:** a page people wait on has a `loading.tsx` skeleton in its own shape (`src/components/skeleton.tsx`), unless its 404 matters (a skeleton streams, so it answers 200). Other waits get a skeleton block or Stonie hopping (`StonieHop`), never a bare spinner.
- **Swipes:** a row of tabs is `data-tabs` / `data-tab` (so pages slide its way), and swiping between them is a `SwipeArea`. Never from the screen's edges (the system's back), never over something that scrolls sideways.

## Card templates (stage 0)
| Template | Idea | Best for |
|---|---|---|
| **Ticket** | cinema ticket stub with perforation, seat/row replaced by stats | movies |
| **Polaroid** | poster in a polaroid frame, handwritten-style review | anything |
| **Bold Stats** | Strava-like: huge numbers below the poster, which runs down to them under a tint of the card colour (no empty middle, 2026-10-01) | series, recaps |
| **Spine** (stage 2) | a book spine on a shelf, cover facing out, stamp or bookmark | books, manga |
| **Manga Panel** (stage 2) | ink panels on paper, speech bubble, screentone, focus lines | manga |
| **Stone** (stage 2) | the number carved into Stonie's tablet, the title that got there pasted below | milestones |
| **Yearbook** (stage 2) | the year in huge type, the top posters pasted across, three standouts | Year in Review |
| **Film Strip** (stage 2, Pro) | the poster as a frame of 35 mm film taped into the album, with a paper label | movies, series |
| **Survived** (stage 2) | a stitched "I SURVIVED" merit patch with the scare's emoji, sewn next to the taped-in poster; offered only when DTDD says the title has a fun scare ([ADR 0035](../decisions/0035-content-warnings-cache-and-survived.md)) | scary movies and series |

Sizes: 9:16 (Stories/TikTok) and 4:5 (feed). Footer: `mystonie · @username` + short link. No QR.

## Mascot: Stonie
A small, round stone with a face, like a friendly carved milestone or stone tablet. When a user finishes a title, Stonie "carves" it into their collection (the celebration moment, alongside the FINISHED stamp). Keep it simple enough to work as a 24px icon and on cards; it never covers poster or stats. Name and meaning: [ADR 0011](../decisions/0011-name-mystonie.md).

## Design system v1 (as built)
Decided in [ADR 0017](../decisions/0017-design-system-v1.md). Source of truth is the code:
- **Tokens:** `src/app/globals.css` (shadcn variables + `--brand`, `--brand-foreground`, `--brand-soft`; Tailwind `bg-brand`, `text-brand`, `bg-brand-soft`). Light: paper `#fcfaf6`, ink `#1d1713`, coral `#cf3c12`. Dark: `#120f0c`, `#f5f1ec`, coral `#f47249`. Checked for WCAG AA in both themes.
- **Type:** `font-display` = Bricolage Grotesque (headlines, wordmark, card titles/numbers), `font-sans` = Geist (UI), `--font-caveat` (polaroid captions), Noto Thai/KR/JP fallbacks. Set up in `src/app/[locale]/layout.tsx`.
- **Logo:** `src/app/icon.svg` (Stonie) and `src/components/logo.tsx` (mark + wordmark).
- **Cards:** shared parts in `src/cards/parts.tsx` (`DISPLAY`, `FinishedStamp`, `CardFooter`), templates in `src/cards/templates/`. Check changes in `/card-lab` and with `pnpm test:e2e`.

## Deliverables from a freelance designer (optional, later)
A designer may refine v1; the list below is what they'd deliver.

Logo + app icon (maskable) · Stonie mascot (neutral, celebrating, sleeping/empty-state poses) · colour tokens (light/dark) · type pairing · the 3 card templates in both sizes · 2 key screens (Home, Celebration) as style reference. Agents translate these into tokens and components.

## PWA
Name "Mystonie", maskable icons, per-theme `theme_color`, standalone display.
