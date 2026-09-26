import { TmdbError } from "@/data/tmdb";
import { allowRequest, type Limit } from "@/data/rate-limit";

/** A 429 response when the caller is over `limit` for `bucket`, else null. */
export async function rateLimited(request: Request, bucket: string, limit: Limit): Promise<Response | null> {
  if (await allowRequest(request.headers, bucket, limit)) return null;
  return Response.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(limit.windowSeconds), "Cache-Control": "no-store" } },
  );
}

/** Maps catalog failures to a JSON error the UI can show as "try again". */
export function catalogError(error: unknown): Response {
  const status = error instanceof TmdbError ? error.status : 500;
  if (status !== 404) console.error(error);
  const code = status === 404 ? "not_found" : status === 503 ? "catalog_unavailable" : "catalog_error";
  return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}
