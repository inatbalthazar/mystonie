# ADR 0065: Signed in, the footer is an app's

**Status:** Accepted · **Date:** 2026-10-01 · Changes the footer of [ADR 0044](0044-games-rawg.md), [ADR 0049](0049-revenue-plan.md) and [ADR 0055](0055-beta-and-feedback.md); follows [ADR 0050](0050-mobile-first-nav-island.md) (mobile first)

## Context
The owner asked where a good app keeps its footer.

Every page had the same website footer, signed in or not:
- the language menu;
- "Mystonie is in beta. Report a problem";
- Privacy and Terms;
- "Buy Stonie a coffee";
- TMDB's logo and notice, and RAWG's credit.

Some things made that a poor fit once someone is signed in:
- **It's a website's habit.** Apps people use daily (Instagram, Strava, Letterboxd, Threads) have no footer on their everyday screens. The language, the legal pages and the credits are under Settings or About.
- **It's tall on a phone.** At 360 px it takes about half a screen above the nav island, at the end of every scrolled page: Feed, Collection, Stats.
- **Most of it is in Settings already.** Settings has the language (Preferences), Report a problem (the beta card) and the tip link (Support Mystonie). The header's BETA stamp opens `/feedback` too.
- **RAWG's terms want its credit, linked, on every page that shows its data or images.** That includes the collection and the feed, not only a game's page. TMDB's notice may sit in an About or Credits section.

## Decision
**Signed out**, the footer stays as it was. People landing on the home page, `/auth`, `/privacy`, `/terms`, a public profile or a shared card should see the language menu, the beta, the legal pages, the tip link and the credits.

**Signed in** (`<html data-auth>`, the `signed-in:` variant), the footer keeps only one row of data credits:
- TMDB's logo, linked; its notice stays the link's accessible name;
- "Game data and images from RAWG", linked.

The row has no border, and it has room below it (`pb-20`) so the round getting-started button ([ADR 0056](0056-getting-started-button.md)) doesn't cover it.

**What moved:**
- **Settings → "About Mystonie":** a new card after Support Mystonie, with Privacy and Terms as rows, and TMDB's full logo and notice with RAWG's credit.
- **Language:** already in Settings → Preferences.
- **Beta and Report a problem:** already in the beta card and the header's BETA stamp.
- **The tip link:** already in Support Mystonie.

Also: Settings' "Signed in with" now names Facebook ([ADR 0064](0064-facebook-sign-in-and-photos.md)).

Rejected:
- **Keeping the website footer everywhere:** it works, but it makes the app feel like a site and costs a phone half a screen.
- **No footer at all when signed in:** the cleanest look, but it breaks RAWG's every-page credit.

## Consequences
- The footer is one element with signed-in variants, so the static layout needs no session and nothing flickers: `data-auth` is set before paint.
- `e2e/profile.spec.ts` checks the signed-in footer:
  - the credits are there;
  - the language menu and Privacy aren't;
  - Privacy, Terms and TMDB's notice are in Settings → About.
- The signed-out footer tests (`e2e/waitlist.spec.ts` and `e2e/feedback.spec.ts`) are unchanged.
