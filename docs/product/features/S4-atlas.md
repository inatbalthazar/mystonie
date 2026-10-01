# S4 · Atlas

**Stage:** 4 (the owner, 2026-10-01) · **Built** 2026-10-01 ([ADR 0059](../../decisions/0059-atlas.md))

## Summary
The collection's fourth tab, Atlas (`/collection/atlas`), after Watch · Read · Play: the places you've collected. One world map with two layers. **Been** shows the countries you've been to, lived in and want to go to. **Stories** shows the countries your movies, series and manga come from. You can share it as a card, and show it on your profile if you want.

## Behaviour
- **Where:** Collection → Atlas, with Collection lit in the nav island. The tab is there even before anything is collected. From the Atlas, Watch, Read and Play go back to the collection on that tab (`/collection?shelf=read`).
- **Numbers on top:**
  - countries you've been to (lived counts)
  - continents of 7
  - countries in your stories
- **Layer switch:** Been · Stories.
- **Map:**
  - Continent chips zoom in: World, Africa, Asia, Europe, North America, South America, Oceania.
  - Small countries are dots, so they can be seen and tapped.
  - A legend sits under the map.
  - Light and dark come from the `--atlas-*` tokens.
- **Been layer:**
  - Colours: been is coral, lived is darker coral, want to go is hatched coral.
  - Add a country by tapping it on the map, or with "Find a country". The search takes a name in your language or English, ignores accents and case, and also takes the code or UK/USA/UAE.
  - Either way opens the country's sheet.
  - Under the map, "Been there · N" and "Want to go · N" list the countries as chips grouped by continent, each with "lived" and the year. Tapping a chip opens its sheet.
  - When a visited country also has stories: "Been there, watched that: stories from N of your M countries."
- **Country sheet:**
  - The country's name and continent.
  - Been there · Lived there · Want to go: one tap saves at once, and rolls back with a message if saving fails.
  - First visit: a year, or "Not sure". Only for a visit.
  - Stories from here: the count and up to 6 posters, linking to their pages.
  - "Take it off my Atlas".
- **Stories layer:**
  - Counts the titles you're watching, reading or have finished. Want to watch doesn't count.
  - Countries come from the cached catalog body: TMDB's origin country, else its production countries, for movies and series; AniList's country of origin for manga. Books and games have none, and the page says so.
  - A co-production counts for each of its countries.
  - Four steps of teal by number of stories.
  - A list of countries with their counts and a bar. Tapping one opens its sheet.
- **Share my Atlas:**
  - The Scratch map card, in story and feed sizes, plus the sticker.
  - Shows the visited countries in the card's accent, with the map zoomed to them (or the whole world when they spread far).
  - The story size lists them by name.
  - Numbers: countries, continents, and countries in my stories.
  - The server saves the card only when its countries are exactly your visited places.
- **Show my Atlas on my profile:**
  - A switch on the Atlas page and in Settings → Privacy. Off by default.
  - When it's on and the profile is public, the album shows an Atlas section: the Been layer's map and "N countries · N continents". Want to go never shows.
  - A note says when the profile is private.
- **A country's regions** ([ADR 0060](../../decisions/0060-atlas-regions.md)): its states, provinces or regions, for 150 countries. Countries drawn as a dot on the world map have none.
  - **In the country's sheet:** a row "Provinces · 6 of 77" with a bar, linking to `/collection/atlas/<cc>`.
  - **The page:**
    - "← Atlas", the country's name, "6/77 provinces you've been to", the share in % and a bar.
    - The country's map. A tap marks or unmarks a region, saved at once. A zoom button doubles the map inside its scrolling frame. Far-off parts (Alaska, Hawaii, the Canaries, Okinawa) sit in dashed frames underneath, and tiny regions are dots.
    - Under the map: "Marked Chiang Mai · Undo".
    - Every region as a chip, sorted in the viewer's language, with "Find a province" (either language, accents ignored).
    - "Share my Japan".
  - **Marking a region puts the country on the Atlas** as Been there, or moves it from Want to go. A note says so while the country isn't visited.
  - **Want to go or "Take it off" clears the country's regions.** With any marked, the sheet asks first, next to the button: "This also clears the 6 provinces you've marked. Take it off · Keep".
  - **The country card:** the Scratch map card with the country's map, the regions in the accent, their names on the story size, and "11 of 47 prefectures · 23% of Japan". The server saves it only when its regions are exactly the ones marked.
  - **Names:** English and Thai from Wikidata, without "Province" or "จังหวัด". Regions with no Thai name show English.
- Country names come from `Intl` in the viewer's language.
- Events: `place_saved` `{ status: "been" | "lived" | "want" | "removed" }` and `region_saved` `{ visited, via: "map" | "list" }`. Never the country or the region.

## Acceptance criteria
- [x] Adding, changing and removing a country (map or search) saves at once and survives a reload. (`e2e/atlas.spec.ts`)
- [x] The Stories layer counts watched, read and finished titles by their countries, and not Want to watch. (`src/core/atlas.test.ts`; `e2e/atlas.spec.ts`)
- [x] Private by default. The album shows the Atlas only with the switch on and a public profile. A block hides it. (`stage4_atlas.test.sql`; `e2e/atlas.spec.ts`)
- [x] The Atlas card saves only the owner's real countries. (`src/core/cards/saved.test.ts`; `e2e/atlas.spec.ts`)
- [x] A country's regions: marked by map or list, undone, kept after a reload, the country added to the Atlas, cleared (after asking) with Want to go or Take it off, and a country card of exactly the marked regions. (`src/core/atlas-regions.test.ts`, `stage4_atlas_regions.test.sql`, `e2e/atlas.spec.ts`)
- [x] 360px first, light and dark, the four tabs fit at 360px, with Collection lit in the nav island.

## Data
- `places` (one live row per country), `place_regions` (one live row per region), `profiles.atlas_public`, and the card kind `atlas`. See the [data model](../../architecture/data-model.md).
- The map is generated by `scripts/atlas-map.mjs` from Natural Earth (public domain) into `src/components/atlas/world-map-data.ts`, and the continents into `src/core/continents.ts`. The regions are generated by `scripts/atlas-regions.mjs` from Natural Earth admin-1 and Wikidata into `public/atlas/regions/v1/<CC>.json` and `src/core/regions.ts`.
