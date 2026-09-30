import { rateLimited } from "@/app/api/_lib/http";
import { normalizePeopleQuery } from "@/core/social";
import { searchPeople } from "@/data/social";
import { userClient } from "@/data/supabase-server";

// Search-as-you-type, debounced in the browser.
const LIMIT = { max: 60, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/** GET /api/people?q= → { people } | 400 (under 2 or over 50 characters) | 401 | 429 | 503. Find people (S3 social). */
export async function GET(request: Request) {
  const query = normalizePeopleQuery(new URL(request.url).searchParams.get("q"));
  if (!query) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "people", LIMIT);
  if (limited) return limited;

  try {
    return Response.json({ people: await searchPeople(supabase, query) }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
