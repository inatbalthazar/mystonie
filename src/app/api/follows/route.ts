import { socialWrite } from "@/app/api/_lib/social";
import { parseUserToggle } from "@/core/social";
import { setFollow } from "@/data/social";

// Tapping through a list of people is fine; following thousands an hour is a script.
const LIMIT = { max: 120, windowSeconds: 3600 };

/** POST /api/follows { userId, follow } → { ok: true } | 400 | 401 | 404 (private, blocked or yourself) | 429 | 503. */
export async function POST(request: Request) {
  return socialWrite(request, "follow", LIMIT, (body) => parseUserToggle(body, "follow"), (db, viewerId, { userId, on }) =>
    setFollow(db, viewerId, userId, on),
  );
}
