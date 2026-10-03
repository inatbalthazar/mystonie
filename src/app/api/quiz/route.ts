import { rateLimited } from "@/app/api/_lib/http";
import { parseQuizAnswer, parseQuizTitle } from "@/core/quiz";
import { activityBadgeNews } from "@/data/badges";
import { quizAnswer, quizNext } from "@/data/scene-warnings";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 120, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

async function signedIn(request: Request) {
  const supabase = await userClient();
  if (!supabase) return { response: Response.json({ error: "unavailable" }, { status: 503, headers: noStore }) };
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return { response: Response.json({ error: "unauthorized" }, { status: 401, headers: noStore }) };
  const limited = await rateLimited(request, "quiz", LIMIT);
  if (limited) return { response: limited };
  return { supabase, userId: auth.claims.sub };
}

/**
 * GET /api/quiz?title=<title id> → the user's next question (S3 warnings & quiz): `{ status: "question", id, kind,
 * topic, title, where, answers }`, or `{ status: "paused", until }` | `{ status: "no_finishes" }` | `{ status: "done" }`.
 * 401 | 429 | 503. `title` (e.g. one just finished) is asked about first. The database stamps when it served it.
 */
export async function GET(request: Request) {
  const user = await signedIn(request);
  if ("response" in user) return user.response;
  try {
    const title = parseQuizTitle(new URL(request.url).searchParams.get("title"));
    return Response.json(await quizNext(user.supabase, title), { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}

/**
 * POST /api/quiz { id, choice: "yes" | "no" | "unsure" } → what happened: `counted` / `not_counted` (with the question's
 * or warning's state), `too_fast`, `paused` (until), `answered`, `gone`. 400 | 401 | 429 | 503. The server's clock
 * decides whether an answer came too fast to count. A yes or no that wasn't too fast also brings `badges`: the quiz
 * stickers it earned (ADR 0063), usually none.
 */
export async function POST(request: Request) {
  const input = parseQuizAnswer(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const user = await signedIn(request);
  if ("response" in user) return user.response;
  try {
    const result = await quizAnswer(user.supabase, input.id, input.choice);
    const helped = input.choice !== "unsure" && (result.status === "counted" || result.status === "not_counted");
    // The streak sticker counts days in the user's time zone (ADR 0094).
    const zone = helped ? (await user.supabase.from("profiles").select("time_zone").eq("id", user.userId).maybeSingle()).data?.time_zone : undefined;
    const badges = helped ? await activityBadgeNews(user.supabase, user.userId, Date.now(), zone ?? "UTC") : [];
    return Response.json({ ...result, badges }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
