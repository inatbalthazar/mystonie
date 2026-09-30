import { socialWrite } from "@/app/api/_lib/social";
import { parseUserToggle } from "@/core/social";
import { setBlock } from "@/data/social";

const LIMIT = { max: 60, windowSeconds: 3600 };

/**
 * POST /api/blocks { userId, block } → { ok: true } | 400 | 401 | 404 (no such user, or yourself) | 429 | 503. Blocking
 * hides both people from each other and removes follows and Stamps between them (S3 social).
 */
export async function POST(request: Request) {
  return socialWrite(request, "block", LIMIT, (body) => parseUserToggle(body, "block"), (db, viewerId, { userId, on }) =>
    setBlock(db, viewerId, userId, on),
  );
}
