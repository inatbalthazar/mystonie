import type { BrowserOptions } from "@sentry/nextjs";

/**
 * Shared Sentry options (browser, Node and edge). Errors only: no tracing, no replay, no PII.
 * Off without a DSN, and off in development so local noise doesn't use the free quota.
 */
export function sentryOptions(): BrowserOptions {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
    // Nothing personal: request bodies carry waitlist emails, headers carry IPs.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { allow: ["user-agent", "referer"] },
      httpBodies: [],
      urlQueryParams: { allow: ["ref", "tpl", "q"] },
    },
    tracesSampleRate: 0,
  };
}
