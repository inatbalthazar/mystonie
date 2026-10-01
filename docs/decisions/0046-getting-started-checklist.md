# ADR 0046: The getting-started checklist: ticked from existing data, skip and install remembered per device

**Status:** Accepted · **Date:** 2026-09-30 · Since [ADR 0056](0056-getting-started-button.md) the checklist opens from a round button on every page instead of sitting on Home, and its counts come from `GET /api/getting-started`

## Context
Roadmap stage 4 asks for a getting-started checklist on Home ([S4 getting started](../product/features/S4-getting-started.md)): five steps ticked from real data, "Skip for now", brought back from Settings, a small celebration at 100 %.

## Decision
- **Steps come from tables we already have** (`entries`, `cards`, `user_avoid_topics`, `follows`, `club_members`), counted on Home's server render. `gettingStarted` in `src/core` decides what's done.
- **"Installed" is seen in the browser** (`display-mode: standalone`) and remembered in `localStorage`. The server can't know it: a push subscription needs the installed app, but plenty of installed users never turn notifications on.
- **"Skip for now" and "celebrated" live in `localStorage`** (per device), wrapped in try/catch; the checklist renders hidden until the browser answers, so a skipped one never flashes.
  - Rejected: a `profiles` column. It would sync the choice across devices, but needs a migration on the remote project before this code deploys (Home would fail without it), for a small convenience. It can move there later without changing the UI.
- No tour overlays or coach marks: they fight the ≤ 3-tap flow.

## Consequences
- A user who skipped on their phone sees the checklist again on another device, and can skip it there too.
- The install step can only tick on a device where the app was opened installed.
