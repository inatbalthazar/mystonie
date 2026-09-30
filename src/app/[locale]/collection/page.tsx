import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CollectionView } from "@/components/collection/collection-view";
import { localizedPath } from "@/core/auth";
import { posterUrl } from "@/core/catalog/images";
import type { SearchResult } from "@/core/catalog/types";
import { parsePick } from "@/core/trending";
import { listCollection } from "@/data/entries";
import { watchLogs } from "@/data/episodes";
import { readLogs } from "@/data/reading";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";
import { avoidBadges } from "@/data/warnings";
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
 * The signed-in user's collection (S1 collection) with the ➕ quick-add sheet. `?add=1` opens the sheet
 * straight away (the header's ➕); with `&pick=<kind>:<id>` (Home's trending, a game's page) it opens on that title's
 * status step. The summary header, filters, sort and tiles/list live in `CollectionView`.
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
  const [{ data: profile }, items, allLogs, reads, t, pick] = await Promise.all([
    supabase.from("profiles").select("time_zone, username").eq("id", userId).single(),
    listCollection(supabase, userId),
    watchLogs(supabase, userId),
    readLogs(supabase, userId),
    getTranslations("Collection"),
    query.add === "1" ? pickedTitle(query.pick) : null,
  ]);

  const timeZone = profile?.time_zone ?? "UTC";
  // Warning badges: cached DTDD data (S2 content warnings) and our own warnings (S3 warnings & quiz).
  const badges = await avoidBadges(supabase, items.flatMap((i) => (i.title.id ? [i.title.id] : [])));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-4 pt-10 pb-28">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      {/* A new ?add=1 (header ➕ while already here) remounts the view with the sheet open. */}
      <CollectionView
        key={query.add === "1" ? `add-${pick ? `${pick.kind}:${pick.externalId}` : ""}` : "list"}
        userId={userId}
        initialItems={items}
        logs={allLogs}
        readLogs={reads}
        username={profile?.username ?? ""}
        host={siteUrl().host}
        timeZone={timeZone}
        startAdding={query.add === "1"}
        startWith={pick}
        warnings={Object.fromEntries(badges)}
      />
    </main>
  );
}
