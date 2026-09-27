// Browser-side PostHog wrapper. posthog-js is loaded lazily (see instrumentation-client.ts), so it
// never delays the first render; events tracked before it loads are queued. No key = no-op.
import type { PostHog } from "posthog-js";
import { landingAttribution, posthogUiHost, type AnalyticsEvent, type AnalyticsEvents } from "@/core/analytics";

type Queued = [AnalyticsEvent, Record<string, unknown>];

/** EU cloud by default (data stays in the EU). Also read by the `/ingest` rewrite in next.config.ts. */
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

let posthog: PostHog | null = null;
let queue: Queued[] = [];

declare global {
  interface Window {
    /** Development/test only: every tracked event, for Playwright assertions. */
    __mystonieEvents?: Queued[];
  }
}

/** Called once from `instrumentation-client.ts`. */
export function initAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const attribution = landingAttribution(window.location.search);

  import("posthog-js").then(({ default: ph }) => {
    ph.init(key, {
      // Same-origin proxy (next.config.ts rewrites) so blockers of *.posthog.com don't drop events.
      api_host: "/ingest",
      ui_host: posthogUiHost(POSTHOG_HOST),
      defaults: "2026-08-30",
      // No cookies or storage; PostHog counts visitors with a daily server-side hash.
      cookieless_mode: "always",
      capture_pageview: "history_change",
      autocapture: false,
      capture_exceptions: false, // Sentry does errors
      capture_heatmaps: false,
      capture_dead_clicks: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      // `ref` / `tpl` from a shared card link ride along on every event, including $pageview.
      before_send: (event) => {
        if (event) event.properties = { ...attribution, ...event.properties };
        return event;
      },
    });
    posthog = ph;
    for (const [event, props] of queue) ph.capture(event, props);
    queue = [];
  });
}

export function track<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]) {
  if (process.env.NODE_ENV !== "production") (window.__mystonieEvents ??= []).push([event, props]);
  if (posthog) posthog.capture(event, props);
  else if (process.env.NEXT_PUBLIC_POSTHOG_KEY) queue.push([event, props]);
}
