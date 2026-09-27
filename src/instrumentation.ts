// Server-side instrumentation: Sentry for route handlers, server components and the proxy.
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

export function register() {
  Sentry.init(sentryOptions());
}

export const onRequestError = Sentry.captureRequestError;
