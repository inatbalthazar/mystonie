// Rare finishes (ADR 0067): instead of "Finisher #N", a finish shows how rare it was, as the share of Mystonie's
// members who had finished the title when this person did ("0.4% of Mystonie"). A finish isn't a race.

/** Below this many members a share says more about how small Mystonie is than about the title, so none is shown. */
export const SHARE_MIN_MEMBERS = 1000;

/** At or under this share a finish is rare: the card gets its stamp and the feed its tag. */
export const RARE_SHARE = 0.1;

/** The smallest share shown as itself; anything under it reads "<0.01%". */
export const SHARE_FLOOR = 0.0001;

/**
 * The share to show, or null: none recorded, or taken while Mystonie had fewer than `SHARE_MIN_MEMBERS` members.
 * `share` comes from the database as a number or a numeric string.
 */
export function shownShare(share: number | string | null | undefined, members: number | null | undefined): number | null {
  const value = typeof share === "string" ? Number(share) : share;
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0 || value > 1) return null;
  if (!members || members < SHARE_MIN_MEMBERS) return null;
  return value;
}

/** A title's share right now (its title page): finishers out of every member. */
export function liveShare(finishers: number, members: number): number | null {
  if (finishers <= 0 || members <= 0) return null;
  return shownShare(Math.min(1, finishers / members), members);
}

export const isRare = (share: number | null | undefined): share is number => !!share && share <= RARE_SHARE;

/** The Intl options a share is printed with (a subset every formatter takes). */
export type ShareFormatOptions = { style: "percent"; maximumFractionDigits?: number; maximumSignificantDigits?: number };

/**
 * How to print a share with Intl's percent style: whole percents from 10%, one decimal from 1%, one significant
 * digit below that ("0.4%", "0.03%"), and `under` (print "<") below `SHARE_FLOOR`. Never rounds a share down to 0%.
 */
export function shareFormat(share: number): { value: number; under: boolean; options: ShareFormatOptions } {
  if (share < SHARE_FLOOR) return { value: SHARE_FLOOR, under: true, options: { style: "percent", maximumFractionDigits: 2 } };
  if (share >= 0.1) return { value: share, under: false, options: { style: "percent", maximumFractionDigits: 0 } };
  if (share >= 0.01) return { value: share, under: false, options: { style: "percent", maximumFractionDigits: 1 } };
  return { value: share, under: false, options: { style: "percent", maximumSignificantDigits: 1 } };
}
