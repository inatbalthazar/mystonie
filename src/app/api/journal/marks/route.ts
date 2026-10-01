import { rateLimited } from "@/app/api/_lib/http";
import { socialWrite } from "@/app/api/_lib/social";
import { isJournalSlug } from "@/core/journal";
import { parseJournalMark } from "@/core/journal-feed";
import { journalSlugs } from "@/data/journal";
import { journalStampCounts, myJournalMarks, setJournalMark } from "@/data/journal-feed";
import { userClient } from "@/data/supabase-server";

const READ = { max: 120, windowSeconds: 60 };
const WRITE = { max: 300, windowSeconds: 3600 };
const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/journal/marks?slug=<slug> → { stamps, stamped, saved, signedIn } | 400 | 404 | 429 | 503. An article
 * page is static, so its Stamp count and the reader's own Stamp and Save come from here (stage 4, ADR 0052).
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!isJournalSlug(slug)) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  if (!(await journalSlugs()).includes(slug)) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  const limited = await rateLimited(request, "journal-marks", READ);
  if (limited) return limited;
  const db = await userClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });

  try {
    const { data: auth } = await db.auth.getClaims();
    const viewerId = auth?.claims.sub ?? null;
    const [counts, marks] = await Promise.all([journalStampCounts(db, slug), viewerId ? myJournalMarks(db, viewerId) : null]);
    return Response.json(
      { stamps: counts.get(slug) ?? 0, stamped: marks?.stamped.has(slug) ?? false, saved: marks?.saved.has(slug) ?? false, signedIn: !!viewerId },
      { headers: noStore },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}

/**
 * POST /api/journal/marks { slug, kind: "stamp" | "save", on } → { ok: true } | 400 | 401 | 404 (no such article) |
 * 429 | 503. A Stamp on a Journal article, or saving it to read later.
 */
export async function POST(request: Request) {
  return socialWrite(request, "journal-mark", WRITE, parseJournalMark, async (db, viewerId, { slug, kind, on }) =>
    (await journalSlugs()).includes(slug) ? setJournalMark(db, viewerId, slug, kind, on) : "not_found",
  );
}
