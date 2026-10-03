# Google Play listing

Everything the store listing asks for, in English and Thai. Every picture is the real app ([ADR 0090](../../docs/decisions/0090-store-listing-from-the-real-app.md)).

## What's here

| File | In Play Console | Size |
|---|---|---|
| `app-icon-512.png` | Main store listing → Graphics → **App icon** | 512 × 512, 32-bit PNG, full square: Play rounds the corners. It's the icon the installed app uses (`brand/png/app-icon-512.png`). |
| `feature-graphic-en.png` | → **Feature graphic** | 1024 × 500 PNG, no transparency |
| `screenshots/en/01-card.png` … `08-warnings.png` | → **Phone screenshots**, in this order | 1080 × 1920 (9:16) PNG, no transparency |
| `feature-graphic-th.png`, `screenshots/th/…` | The same places in the Thai translation | as above |
| `listing-en.md`, `listing-th.md` | App name, short and full description | counted against Play's limits |

## The screenshots
Eight album pages. Each shows a real screen inside a taped-in phone, with the landing page's tour headings ([ADR 0089](../../docs/decisions/0089-landing-tour.md)) and a note in pen:

1. **Turn every finish into art.** The celebration, with the card, after a finish.
2. **Your whole collection, on one shelf.** Me: Right now and the Shelf.
3. **Your year in big numbers.** Stats in dark mode.
4. **Better with friends.** The feed, with Stamps.
5. **Every episode, chapter and level.** A series' episodes and where to watch it.
6. **See the world from your couch.** The Atlas in dark mode.
7. **Stickers for every milestone.** Milestones and the sticker album.
8. **Know before you press play.** The check before you watch.

The first three show up without scrolling, so they carry the idea: the card, the collection, the numbers.

The account in them is Maya, a demo collector, and her friends Leo, Sana, Kofi and Lucía are demo accounts too. Their year is made up; the titles, posters and warnings come from the catalogs, as for anyone.

## In Play Console (once)
1. **Grow users → Store presence → Main store listing:**
   - the app name and the two descriptions from `listing-en.md`;
   - then the icon, `feature-graphic-en.png` and `screenshots/en` 01–08.
2. **Manage translations → Add your own translations → Thai (th-TH):**
   - the text from `listing-th.md`;
   - then, under the Thai listing's graphics, `feature-graphic-th.png` and `screenshots/th`.
3. **Store settings:**
   - category **Entertainment**;
   - website `https://mystonie.com`;
   - privacy policy `https://mystonie.com/privacy`.
4. **Tablet screenshots** are optional. Without them, Play still installs Mystonie on tablets but doesn't feature it there.

Before the first release, Play also asks for the **App content** section:
- **Ads:** No.
- **App access:** most of the app needs an account. Give the reviewers a way in, an account they can sign in to without a code from someone's inbox.
- **Data safety form**, **content rating** and **target audience**.

When Pro goes on sale, the Android app must sell it through Google Play Billing, not Stripe.

## Remaking them
When the app changes, remake everything in one go (about 10 minutes):

1. `pnpm db:start`. The scripts refuse any Supabase but the local one, because they make and delete accounts.
2. `pnpm build && PORT=3100 VERCEL_PROJECT_PRODUCTION_URL=mystonie.com pnpm start`. The variable puts mystonie.com in the cards' footers.
3. `node scripts/store/make.mjs`. It:
   - deletes the old demo accounts and seeds Maya's world again;
   - captures the screens in English and Thai, light and dark;
   - exports the cards;
   - lays everything out here.

   `--reuse` keeps the last demo world and skips the seed.

You'll need:
- Chrome;
- the catalog keys in `.env.local` (TMDB, Google Books, RAWG, DoesTheDogDie);
- the network, for the posters and Google Fonts.

What to edit:
- the headings, notes and layout: `scripts/store/compose.mjs`;
- Maya's year: `seed.mjs`;
- which screens: `capture.mjs`.

The finished dates stretch over the current year, so "This year" stays full whenever the scripts run.
