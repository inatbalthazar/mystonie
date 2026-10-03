// Makes the Play Store screenshots and feature graphic into brand/play-store (README there, ADR 0090):
//   pnpm db:start, then pnpm build && PORT=3100 VERCEL_PROJECT_PRODUCTION_URL=mystonie.com pnpm start, then
//   node scripts/store/make.mjs            (seed the demo world, capture, compose)
//   node scripts/store/make.mjs --reuse    (keep the demo world from the last run: capture and compose only)
import { BASE } from "./lib.mjs";

const health = await fetch(`${BASE}/api/health`).catch(() => null);
if (!health?.ok) throw new Error(`No app at ${BASE}: start a production build on :3100 first (see brand/play-store/README.md).`);

if (!process.argv.includes("--reuse")) await (await import("./seed.mjs")).seed();
await (await import("./capture.mjs")).capture();
await (await import("./compose.mjs")).compose();
