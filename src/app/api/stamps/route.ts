import { socialWrite } from "@/app/api/_lib/social";
import { parseStamp } from "@/core/social";
import { setStamp } from "@/data/social";

const LIMIT = { max: 300, windowSeconds: 3600 };

/**
 * POST /api/stamps { entryId, stamped } → { ok: true } | 400 | 401 | 404 (not a finish you can see, or your own) | 429 |
 * 503. A Stamp is kudos on someone's finish (S3 social).
 */
export async function POST(request: Request) {
  return socialWrite(request, "stamp", LIMIT, parseStamp, (db, viewerId, { entryId, stamped }) => setStamp(db, viewerId, entryId, stamped));
}
