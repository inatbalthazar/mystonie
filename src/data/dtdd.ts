// Server-side DoesTheDogDie client (S2 content warnings, ADR 0009, ADR 0035). Only server code calls this; the key
// (`DTDD_API_KEY`, header `X-API-KEY`) never reaches the browser. The free tier allows 30 requests a minute and
// 5,000 a month, so every call first takes a slot from a shared per-minute and per-day budget.
import {
  DTDD_URL,
  dtddMediaUrl,
  matchDtddItem,
  normalizeDtddMedia,
  normalizeDtddSearch,
  normalizeDtddTopics,
  type DtddItem,
  type TitleWarnings,
  type WarningsProvider,
  type WarningTitle,
  type WarningTopic,
} from "@/core/catalog/dtdd";
import { CatalogError } from "./catalog-error";
import { adminClient } from "./supabase-admin";

const DAY = 86_400;

/** Our share of DTDD's free tier: under its 30 a minute, and 5,000 a month spread over the days. */
const BUDGET = [
  { key: "dtdd:minute", windowSeconds: 60, max: 25 },
  { key: "dtdd:day", windowSeconds: DAY, max: 160 },
] as const;

/** Takes one call from the shared budget; false when it's used up. Fails open without Supabase, like our rate limits. */
async function takeBudget(): Promise<boolean> {
  const db = adminClient();
  if (!db) return true;
  for (const { key, windowSeconds, max } of BUDGET) {
    const { data, error } = await db.rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
    if (error) {
      console.error("rate_limit_hit failed", error.message);
      return true;
    }
    if (!data) return false;
  }
  return true;
}

/** `revalidate` caches the response in Next's fetch cache; without it nothing is cached (the media bodies are ~1.5 MB). */
async function dtdd(path: string, revalidate?: number): Promise<unknown> {
  const key = process.env.DTDD_API_KEY;
  if (!key) throw new CatalogError("DTDD_API_KEY is not set", 503);
  if (!(await takeBudget())) throw new CatalogError("DTDD budget used up", 429);
  const res = await fetch(DTDD_URL + path, {
    headers: { "X-API-KEY": key, Accept: "application/json", "User-Agent": "Mystonie (content warnings)" },
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new CatalogError(`DTDD ${path.split("?")[0]} responded ${res.status}`, res.status === 404 ? 404 : 502);
  return res.json();
}

/** Every DTDD topic (Settings → Warnings), cached a week in Next's fetch cache (~470 KB). */
export async function dtddTopics(): Promise<WarningTopic[]> {
  return normalizeDtddTopics(await dtdd("/categories", 7 * DAY));
}

async function search(query: string): Promise<DtddItem[]> {
  return normalizeDtddSearch(await dtdd(`/dddsearch?${new URLSearchParams({ q: query.slice(0, 100) })}`, DAY));
}

/** DTDD as a warnings source: find the title (by TMDB or IMDb id, else name + year + type), then its votes. */
export const dtddProvider: WarningsProvider = {
  async lookup(title: WarningTitle): Promise<TitleWarnings> {
    let items = await search(title.name);
    let match = matchDtddItem(items, title);
    if (!match && title.originalName && title.originalName !== title.name) {
      items = [...items, ...(await search(title.originalName))];
      match = matchDtddItem(items, title);
    }
    if (!match) return { status: "unmatched" };
    return { status: "matched", sourceId: match.id, sourceUrl: dtddMediaUrl(match.id), topics: normalizeDtddMedia(await dtdd(`/media/${match.id}`)) };
  },
};
