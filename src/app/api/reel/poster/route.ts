import { tmdbImageUrl } from "@/core/catalog/tmdb";
import { isReelDay, posterSize, reelDay, REEL_GUESSES } from "@/core/reel";
import { storedReel } from "@/data/reel";

/**
 * GET /api/reel/poster?day=2026-09-30&step=0–6 → the reel's poster (stage 4 daily game, ADR 0048), through us so the
 * page never holds a URL that names the movie. Tiny while the play is early (the page blurs it), bigger as it
 * sharpens. Only for today's reel and earlier ones.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const day = params.get("day");
  const step = Number(params.get("step"));
  if (!isReelDay(day) || day > reelDay(Date.now()) || !Number.isInteger(step) || step < 0 || step > REEL_GUESSES) {
    return new Response(null, { status: 404 });
  }
  const reel = await storedReel(day).catch(() => null);
  if (!reel?.posterPath) return new Response(null, { status: 404 });
  const res = await fetch(tmdbImageUrl(reel.posterPath, posterSize(step)), { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return new Response(null, { status: 502 });
  return new Response(await res.arrayBuffer(), {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      // One day's reel never changes; the URL carries the day and the step.
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
