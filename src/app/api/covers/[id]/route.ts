const MAX_BYTES = 2 * 1024 * 1024;

/**
 * GET /api/covers/[volumeId][?size=large] → a Google Books cover (JPEG/PNG). Google serves covers without CORS headers,
 * and cards render in the browser through a canvas, so book covers come from our own origin (ADR 0029). Only Google's
 * cover endpoint is ever fetched, for a well-formed volume id (no open proxy). Cached a month at the CDN.
 * Sizes: 300 px wide (like TMDB's w342), `large` 575 px.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/covers/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) return new Response(null, { status: 404 });
  const zoom = new URL(request.url).searchParams.get("size") === "large" ? 3 : 2;

  let upstream: Response;
  try {
    upstream = await fetch(`https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=${zoom}&source=gbs_api`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !/^image\/(jpeg|png)$/.test(type)) {
    return new Response(null, { status: upstream.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" } });
  }
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
