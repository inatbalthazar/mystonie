import type { FullConfig } from "@playwright/test";

// A cold `next dev` compiling several routes at once, one per worker, now and then fails a request with
// "SyntaxError: Unexpected end of JSON input" from inside Next, which broke whichever test hit it first. So before
// the workers start, ask for each route the tests use once, one at a time. GETs only: a POST-only route answers
// 405, which still compiles it.
const ROUTES = [
  "/",
  "/sign-in",
  "/collection",
  "/collection/atlas",
  "/collection/atlas/jp",
  "/settings/import",
  "/offline",
  "/quiz",
  "/title/movie/0",
  "/api/health",
  "/api/quiz",
  "/api/scene-warnings",
  "/api/scene-warnings/0",
  "/api/entries",
  "/api/entries/0",
  "/api/episodes",
  "/api/episodes/0",
  "/api/reading",
  "/api/reading/0",
  "/api/cards",
  "/api/milestones",
  "/api/billing/status",
  "/api/billing/webhook",
  "/api/import/match",
  "/api/import/commit",
  "/api/account",
  "/api/push",
  "/api/reports",
  "/feedback",
  "/api/feedback",
  "/api/getting-started",
  "/pro",
  "/feed",
  "/reel",
  "/api/reel",
  "/people",
  "/api/follows",
  "/api/stamps",
  "/api/blocks",
  "/api/feed",
  "/api/people?q=ab",
  "/api/search?q=a",
  "/api/trending",
];

export default async function warmUp(config: FullConfig) {
  const base = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  for (const path of ROUTES) {
    await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(120_000) }).catch(() => undefined);
  }
}
