import { after } from "next/server";
import { rateLimited } from "@/app/api/_lib/http";
import { isUuidV7 } from "@/core/ids";
import { parsePostWrite } from "@/core/journal-posts";
import { deletePost, emailReviewRequest, savePost } from "@/data/journal-posts";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";
import { routing } from "@/i18n/routing";

// A writer saves often (each draft and each publish); this stops scripts, not people.
const LIMIT = { max: 120, windowSeconds: 3600 };
const MAX_BODY_BYTES = 120_000;
const noStore = { "Cache-Control": "no-store" };

/**
 * PUT /api/journal/posts { id, locale, title, description?, body, tags, subjects, spoilers, publish, feature } →
 * { post: { id, state } } | 400 { error: "invalid" | problem } | 401 | 404 (someone else's id) | 422 (a subject the
 * catalog doesn't know) | 429 (too often, or too many articles: { error: "limit" }) | 503. Saves a member's Journal
 * article (stage 4, ADR 0092): a draft, or published and maybe sent to be Featured, which emails the team.
 */
export async function PUT(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const parsed = parsePostWrite(body, routing.locales);
  if (!parsed.ok) return Response.json({ error: parsed.problem }, { status: 400, headers: noStore });

  const db = await userClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await db.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const limited = await rateLimited(request, "journal-post", LIMIT);
  if (limited) return limited;

  try {
    // Every title it's about is cached, so readers see its poster and name (and a made-up id is refused).
    const titles = parsed.post.subjects.flatMap((s) => (s.kind === "place" ? [] : [s]));
    const found = await Promise.all(titles.map((s) => ensureTitle(s.kind, s.externalId).catch(() => null)));
    if (found.some((f) => !f)) return Response.json({ error: "subjects" }, { status: 422, headers: noStore });

    const saved = await savePost(db, userId, parsed.post);
    if (!saved.ok) {
      return saved.reason === "limit"
        ? Response.json({ error: "limit" }, { status: 429, headers: noStore })
        : Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    }
    if (saved.sentForReview) {
      const { data } = await db.from("profiles").select("username").eq("id", userId).maybeSingle();
      after(() => emailReviewRequest(saved.post, data?.username ?? null));
    }
    return Response.json({ post: { id: saved.post.id, state: saved.post.state } }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}

/** DELETE /api/journal/posts?id=<id> → { ok: true } | 400 | 401 | 404 | 429 | 503. Deletes the writer's article. */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.toLowerCase() ?? "";
  if (!isUuidV7(id)) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const db = await userClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await db.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const limited = await rateLimited(request, "journal-post", LIMIT);
  if (limited) return limited;
  try {
    const deleted = await deletePost(db, userId, id);
    return deleted ? Response.json({ ok: true }, { headers: noStore }) : Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
