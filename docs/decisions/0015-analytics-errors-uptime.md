# ADR 0015: Analytics, error tracking and uptime (stage 0)

**Status:** Accepted · **Date:** 2026-09-26

## Context
Stage 0's pass criteria are measured in PostHog (cards created, share/download rate, waitlist), attribution from shared cards (`?ref=card&tpl=…`) must be visible, errors must reach us, and the free Supabase project pauses after a week without traffic. The spec also asks for Lighthouse mobile ≥ 90 and no consent banner.

## Decision
- **PostHog via `posthog-js`, cookieless** (`cookieless_mode: "always"`): no cookies or storage; PostHog counts visitors with a daily server-side hash. Autocapture, session replay, surveys, heatmaps, feature flags and external script loading are off. Pageviews use `capture_pageview: "history_change"`. **EU cloud by default** (`NEXT_PUBLIC_POSTHOG_HOST`), so analytics data stays in the EU.
- **Same-origin proxies:** `/ingest/*` rewrites to PostHog (next.config.ts) and Sentry's `tunnelRoute` is `/monitoring`, so blockers of third-party analytics domains don't drop events. `src/proxy.ts` skips both paths.
- **`ref` / `tpl` on every event** (including `$pageview`) through `before_send`, read once from the landing URL (`landingAttribution` in `src/core/analytics.ts`, slug values only).
- **Typed event contract** in `src/core/analytics.ts`: `card_created`, `template_switched` (`via` button/swipe), `size_switched`, `card_shared`, `card_downloaded` (`fallback` when Share wasn't possible), `waitlist_joined` (`placement`). Stage 1 adds `card` / `channel` to the card events and `signup_from_card` ([ADR 0024](0024-card-saving-and-share-links.md)). `track()` in `src/lib/analytics.ts` queues events until PostHog loads; in development it also records them on `window.__mystonieEvents` for Playwright.
- **Sentry with `@sentry/nextjs`, errors only:** no tracing, no replay, and `dataCollection` off for user info, cookies, request bodies (waitlist emails) and headers except user-agent/referer. Disabled without a DSN and in development. Source maps upload only when `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` are set.
- **Both browser SDKs load after `load` + idle** (`src/instrumentation-client.ts`). Loading them eagerly cost the first screen ~10 Lighthouse points (78 → 87–89 locally after the change). Trade-off: a browser error thrown in the first second or two isn't reported. Server errors are always captured (`onRequestError` in `src/instrumentation.ts`).
- **Uptime:** `GET /api/health` reads one row from Supabase and returns 200 or 503. An external free monitor (UptimeRobot or Better Stack, owner's choice) polls it every 5 minutes and alerts by email; a daily Vercel cron (`vercel.json`) also calls it. Either keeps Supabase awake. No self-built status page.
- Rejected: Vercel Analytics (per-event pricing, no funnels), a hand-written PostHog HTTP client (smaller, but we'd own batching, retries and the cookieless protocol), Plausible (second paid service).

## Consequences
- PostHog **drops events from headless browsers** (its bot filter), so Playwright checks `window.__mystonieEvents`, not PostHog. Verified by hand with the filter off: `$pageview` goes to `/ingest/e/` with `ref`/`tpl`, `distinct_id` `$posthog_cookieless`, and no cookies or storage.
- The PostHog project must have **cookieless server hash mode enabled** and **"Discard client IP data"** on, or cookieless events are ignored / IPs stored. Sentry's "Prevent storing IP addresses" should be on.
- Adding a new event means adding it to `AnalyticsEvents` first.
