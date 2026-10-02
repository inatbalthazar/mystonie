import { FreshPage } from "@/components/motion/fresh-page";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CollectionView } from "@/components/collection/collection-view";
import { localizedPath } from "@/core/auth";
import { posterUrl } from "@/core/catalog/images";
import type { SearchResult } from "@/core/catalog/types";
import { isCollectionShelf } from "@/core/collection/view";
import { weekStartFor } from "@/core/stats/period";
import { collectionCards } from "@/core/stats/report";
import { parsePick } from "@/core/trending";
import { listCollection } from "@/data/entries";
import { watchLogs } from "@/data/episodes";
import { readLogs } from "@/data/reading";
import { statsRows } from "@/data/stats";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";
import { avoidBadges, avoidTopicIds, dtddKnown } from "@/data/warnings";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Collection");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/** `?pick=movie:496243` (a trending title on Home, a game's page: any kind) as a quick-add result, or null. */
async function pickedTitle(raw: string | string[] | undefined): Promise<SearchResult | null> {
  const pick = parsePick(raw);
  if (!pick) return null;
  const title = await ensureTitle(pick.kind, pick.externalId).catch(() => null);
  if (!title) return null;
  const { source, kind, externalId, name, year, posterPath, platforms } = title.title;
  const imageUrl = posterUrl(source, posterPath);
  return { source, kind, externalId, name, ...(year ? { year } : {}), ...(imageUrl ? { imageUrl } : {}), ...(platforms.length ? { platforms } : {}) };
}

/**
 * The signed-in user's collection (S1 collection) with the ➕ quick-add sheet. `?add=1` opens the sheet straight away
 * (the nav island's ➕ on another page); with `&pick=<kind>:<id>` (Home's trending, a game's page) it opens on that
 * title's status step; `?shelf=read` opens on that tab. The summary header, filters, sort and tiles/list live in
 * `CollectionView`. The Atlas tab is its own page, `/collection/atlas` (ADR 0059).
 */
export default async function CollectionPage({ params, searchParams }: PageProps<"/[locale]/collection">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/collection", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const query = await searchParams;
  const [{ data: profile }, items, allLogs, reads, t, pick, rows] = await Promise.all([
    supabase.from("profiles").select("time_zone, username").eq("id", userId).single(),
    listCollection(supabase, userId),
    watchLogs(supabase, userId),
    readLogs(supabase, userId),
    getTranslations("Collection"),
    query.add === "1" ? pickedTitle(query.pick) : null,
    statsRows(supabase, userId),
  ]);

  const timeZone = profile?.time_zone ?? "UTC";
  // "Share my collection" (stage 4): an all-time card per area (watched, read, played).
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const areaCards = collectionCards(rows.titles, rows.entries, rows.logs, { timeZone, weekStart: weekStartFor(locale), now }, rows.reads);
  // Warning badges: cached DTDD data (S2 content warnings) and our own warnings (S3 warnings & quiz).
  const [badges, avoid] = await Promise.all([
    avoidBadges(
      supabase,
      items.flatMap((i) => (i.title.id ? [i.title.id] : [])),
    ),
    avoidTopicIds(supabase, userId),
  ]);
  // Want-to-watch titles DTDD knows with no badge: their pre-watch check is clear (stage 4).
  const cleared =
    avoid.length > 0
      ? await dtddKnown(
          supabase,
          items.flatMap((i) => (i.status === "want" && i.title.id && !badges.has(i.title.id) ? [i.title.id] : [])),
        )
      : new Set<string>();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-4 pt-10 pb-28">
      <FreshPage />
      {/* Stays put while the Atlas and the shelves trade places (ADR 0081). */}
      <h1 data-stay="collection-title" className="font-display text-4xl font-extrabold tracking-[-0.03em]">
        {t("title")}
      </h1>
      {/* No key from `?add=1`: closing quick add drops it from the URL, and the refresh after a save would then remount
          the view and close the celebration. The nav island's ➕ opens quick add in place here (ADR 0050). */}
      <CollectionView
        userId={userId}
        initialItems={items}
        logs={allLogs}
        readLogs={reads}
        username={profile?.username ?? ""}
        host={siteUrl().host}
        timeZone={timeZone}
        startAdding={query.add === "1"}
        startWith={pick}
        startShelf={isCollectionShelf(query.shelf) ? query.shelf : null}
        warnings={Object.fromEntries(badges)}
        cleared={[...cleared]}
        shareCards={areaCards}
      />
    </main>
  );
}
