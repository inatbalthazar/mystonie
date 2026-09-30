import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { posthogAssetsHost } from "./src/core/analytics";

// Picks up src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

const nextConfig: NextConfig = {
  // Same-origin PostHog proxy (src/lib/analytics.ts). src/proxy.ts must skip /ingest.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${posthogAssetsHost(posthogHost)}/static/:path*` },
      { source: "/ingest/:path*", destination: `${posthogHost}/:path*` },
    ];
  },
  // The service worker (public/sw.js, ADR 0028) must never be cached, so fixes reach installed apps at once. Its own
  // fetches follow this policy: it keeps posters from the catalogs' image hosts for offline use (ADR 0042).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; connect-src 'self' https://image.tmdb.org https://s4.anilist.co https://media.rawg.io",
          },
        ],
      },
    ];
  },
  // PostHog's API uses trailing slashes; don't redirect them away.
  skipTrailingSlashRedirect: true,
  experimental: {
    // Development only: React's debug info comes inside the page, as in production builds, instead of over a
    // WebSocket that a page opened offline never gets, which stops it from hydrating (S3 offline, ADR 0042).
    reactDebugChannel: false,
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Source maps upload only when these are set (Vercel env); otherwise the build just skips it.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Error reports go through our domain, so ad blockers don't drop them. src/proxy.ts must skip it.
  tunnelRoute: "/monitoring",
  // The browser SDK loads lazily in src/instrumentation-client.ts (no navigation tracing needed).
  suppressOnRouterTransitionStartWarning: true,
});
