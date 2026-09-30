import { socialWrite } from "@/app/api/_lib/social";
import { parseClubToggle } from "@/core/clubs";
import { setClub } from "@/data/clubs";

// A dozen clubs: tapping join and leave now and then is fine; hundreds an hour is a script.
const LIMIT = { max: 60, windowSeconds: 3600 };

/** POST /api/clubs { club, join } → { ok: true } | 400 | 401 | 429 | 503 (S3 challenges & clubs). */
export async function POST(request: Request) {
  return socialWrite(request, "club", LIMIT, parseClubToggle, (db, viewerId, { club, on }) => setClub(db, viewerId, club, on));
}
