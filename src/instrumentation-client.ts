// Runs in the browser before the app hydrates (Next.js instrumentation-client).
// Sentry and PostHog are ~100 KB each, so both load only after the page is up and the main thread
// is idle: they must not cost the first screen its Lighthouse score. Errors thrown before that are missed.
import { initAnalytics } from "@/lib/analytics";
import { sentryOptions } from "@/lib/sentry";

function whenIdleAfterLoad(run: () => void) {
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 1500));
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

whenIdleAfterLoad(() => {
  const options = sentryOptions();
  if (options.enabled) import("@sentry/nextjs").then((Sentry) => Sentry.init(options));
  initAnalytics();
});
