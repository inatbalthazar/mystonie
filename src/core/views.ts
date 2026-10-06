// Visits (ADR 0098): how many people opened your page, your shared cards and your Journal articles, never who. A page
// counts once it's shown in a browser (POST /api/views), each visitor once a day; the owner's own visits never count.
import { isUuid } from "./email/unsubscribe";

export const VIEW_SUBJECTS = ["profile", "card", "post"] as const;
export type ViewSubject = (typeof VIEW_SUBJECTS)[number];

/** The window the "lately" numbers cover, in days (today included). */
export const RECENT_VIEW_DAYS = 7;

/** POST /api/views `{ subject, id }`. */
export function parseView(body: unknown): { subject: ViewSubject; id: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const { subject, id } = body as Record<string, unknown>;
  if (typeof subject !== "string" || !(VIEW_SUBJECTS as readonly string[]).includes(subject)) return null;
  if (typeof id !== "string" || !isUuid(id)) return null;
  return { subject: subject as ViewSubject, id: id.toLowerCase() };
}

// Crawlers, link previews and headless browsers. Previews don't run the page's script anyway; this catches the rest.
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|embedly|headless|lighthouse|python|curl|wget|okhttp/i;

/** Whether a User-Agent is a crawler, a link preview or a script rather than a person's browser. */
export const isBotAgent = (userAgent: string | null): boolean => !userAgent || BOT.test(userAgent);

/**
 * What the visitor hash is made from (salted and hashed by the server, never stored as is): the day (UTC), so the same
 * visitor counts again tomorrow and can't be followed across days, and the signed-in viewer's id, or else the IP
 * address and browser.
 */
export function visitorSeed(day: string, viewerId: string | null, ip: string, userAgent: string): string {
  return viewerId ? `${day}|u|${viewerId}` : `${day}|a|${ip}|${userAgent}`;
}

/** Visits to one thing: in the last `RECENT_VIEW_DAYS` days and all time. */
export type ViewCount = { recent: number; total: number };

/** `subject:id` → its visits, from `my_views()`. */
export type ViewCounts = ReadonlyMap<string, ViewCount>;

export const viewKey = (subject: ViewSubject, id: string) => `${subject}:${id}`;

const NONE: ViewCount = { recent: 0, total: 0 };

/** The visits to one thing (none when nobody came). */
export const viewsOf = (counts: ViewCounts, subject: ViewSubject, id: string): ViewCount => counts.get(viewKey(subject, id)) ?? NONE;

/** All visits to one kind of thing, added up. */
export function viewsOfKind(counts: ViewCounts, subject: ViewSubject): ViewCount {
  let recent = 0;
  let total = 0;
  for (const [key, count] of counts) {
    if (!key.startsWith(`${subject}:`)) continue;
    recent += count.recent;
    total += count.total;
  }
  return { recent, total };
}
