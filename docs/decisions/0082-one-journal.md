# ADR 0082: One Journal, saved articles in one place

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0052](0052-journal-feed.md) and [ADR 0062](0062-journal-in-the-feed.md) (the feed's "Articles" tab, saved articles on the album)

## Context
The owner (2026-10-02) found the Journal and the articles repeating each other. Since ADR 0062 they are one thing: the Journal's list lives in the feed. But two overlaps were left:
- **Two names:**
  - The feed's tab said **Articles**.
  - Home said "From the Journal", a title's page "In the Journal", and the challenges "Write an article for the Journal".
  - Every article lives at `/journal/<slug>`.
- **Saved articles in two places:** the feed's **Saved** tab and the album's "Saved to read" section on Me.

## Decision
- **One name, Journal:**
  - The feed's tabs are Following · Journal · Saved, in English and Thai alike.
  - Each piece in it is still "an article" ("3 min read", "The first article is on its way").
  - The tab's id stays `articles` (`?tab=articles`, the feed dot), so links and code don't change.
- **Saved articles only on the feed's Saved tab:** "Saved" leaves the album's sections (`ALBUM_SECTIONS`) and Arrange.
  - A saved order or hidden list that still names it just skips it, as with "cards" ([ADR 0076](0076-cards-tab.md)).
  - The database's check still allows the value, so no migration.

**Rejected:**
- **"Articles" everywhere:** more copy to change, and the name would no longer match the `/journal/…` addresses.
- **A "Saved articles →" link on the album instead of the list:** it's still a second way to the same place, and the feed's Saved tab is one tap from the island.

## Consequences
- **Copy:** `Social.tabArticles` is now "Journal", and the unused `Journal.savedTitle` and `seeAllSaved` keys are removed.
- **Album:** `ProfileAlbum` no longer reads saved articles, so Me's album makes one query fewer.
- **Tests:**
  - Unit: `album.test.ts`, `account.test.ts`.
  - e2e: `journal.spec.ts` (the tab's name; no "Saved to read" on Me), `motion.spec.ts`, `social.spec.ts`.
