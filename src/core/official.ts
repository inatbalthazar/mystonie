// Official accounts (ADR 0098): Stonie, the mascot, and the team's own accounts. Never people pretending: each one
// carries a label wherever its name shows, and Stonie's account can't be signed in to.
import { isTitleKind, type TitleKind } from "./catalog/types";

/** Stonie's account id (supabase/migrations/20261027090000_stage4_lively_album.sql). */
export const MASCOT_ID = "5707e000-0000-4000-8000-000000000001";

export type Official = "mascot" | "team";

export const isOfficial = (value: unknown): value is Official => value === "mascot" || value === "team";

/** id → label, from `official_accounts()`. */
export type OfficialMap = ReadonlyMap<string, Official>;

/** The finish counts Stonie stamps (`private.stonie_cheers`). */
export const MASCOT_COUNTS = [1, 10, 25, 50, 100, 250, 500, 1000] as const;

/** Why Stonie stamped a finish, for the activity line: a count of finishes, or the first of a kind. */
export type MascotCheer = { type: "count"; count: number } | { type: "first"; kind: TitleKind };

/**
 * The cheer to tell from the milestones one finish reached (`finishes:10`, `first:book`): the biggest count (the very
 * first finish is also a first of its kind, and says so as a count), else the first of a kind; null when none is known.
 */
export function mascotCheer(milestones: readonly string[]): MascotCheer | null {
  let count = 0;
  let kind: TitleKind | null = null;
  for (const m of milestones) {
    const [type, value] = m.split(":");
    if (type === "finishes" && Number.isInteger(Number(value)) && Number(value) > count) count = Number(value);
    else if (type === "first" && isTitleKind(value)) kind ??= value;
  }
  if (count > 0) return { type: "count", count };
  return kind ? { type: "first", kind } : null;
}
