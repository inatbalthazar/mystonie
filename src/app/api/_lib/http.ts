import { timingSafeEqual } from "node:crypto";
import { CatalogError } from "@/data/catalog-error";
import { allowRequest, type Limit } from "@/data/rate-limit";

/**
 * Whether the request carries `Authorization: Bearer <secret>` (constant-time). A missing or short secret
 * (under 16 characters) never matches, so an unset env var can't open the route.
 */
export function bearerAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

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
  const status = error instanceof CatalogError ? error.status : 500;
  if (status !== 404) console.error(error);
  const code = status === 404 ? "not_found" : status === 503 ? "catalog_unavailable" : "catalog_error";
  return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}
