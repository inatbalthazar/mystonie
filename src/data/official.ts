// Official accounts (ADR 0098): who gets the Mascot or Team label. A handful of rows, read through
// `official_accounts()` and kept for a minute per server instance. Server only.
import { isOfficial, type Official, type OfficialMap } from "@/core/official";
import type { UserClient } from "./supabase-server";

const KEEP_MS = 60_000;
let memo: { at: number; map: OfficialMap } | null = null;

/** id → Mascot or Team. Never fails a page: without the function (a database not migrated yet) nobody is official. */
export async function officialAccounts(db: UserClient): Promise<OfficialMap> {
  const now = Date.now();
  if (memo && now - memo.at < KEEP_MS) return memo.map;
  const { data, error } = await db.rpc("official_accounts");
  if (error) {
    console.error(`official_accounts failed: ${error.message}`);
    return new Map();
  }
  const map = new Map<string, Official>(data.flatMap((r) => (isOfficial(r.official) ? [[r.id, r.official] as const] : [])));
  memo = { at: now, map };
  return map;
}

/** After the team's label changes (POST /api/admin/team-label): read again on the next request. */
export function forgetOfficialAccounts() {
  memo = null;
}

/** The label of one account, if it has one. */
export const officialOf = (map: OfficialMap, id: string): Official | null => map.get(id) ?? null;
