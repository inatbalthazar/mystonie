import { mystonieCsvFiles } from "@/core/import/mystonie";
import { writeZip } from "@/core/import/zip";
import { exportCollection } from "@/data/export";
import { userClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/account/export/csv → a ZIP download of the collection as spreadsheets (S3 import & export, ADR 0041):
 * `collection.csv` (every title with its status, finish time, rating and review), `episodes.csv` and `reading.csv`.
 * Importing the ZIP again restores it, here or in another account. 401 | 503.
 */
export async function GET() {
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  try {
    const [{ entries, episodes, reading }, { data: profile }] = await Promise.all([
      exportCollection(supabase, userId),
      supabase.from("profiles").select("username").eq("id", userId).single(),
    ]);
    const now = new Date();
    const zip = writeZip(mystonieCsvFiles(entries, episodes, reading), now);
    const name = `mystonie-${profile?.username ?? "collection"}-${now.toISOString().slice(0, 10)}-csv.zip`;
    return new Response(zip as Uint8Array<ArrayBuffer>, {
      headers: { ...noStore, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"` },
    });
  } catch (e) {
    console.error("csv export failed", e);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
