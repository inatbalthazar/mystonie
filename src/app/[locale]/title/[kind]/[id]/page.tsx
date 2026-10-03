import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RememberTitles } from "@/components/offline/recent-titles";
import { SeriesEpisodes } from "@/components/series/series-episodes";
import { ContentWarnings, ContentWarningsSkeleton } from "@/components/title/content-warnings";
import { TitleJournal } from "@/components/journal/title-journal";
import { TitleFinishers } from "@/components/title/finishers";
import { SceneWarnings, SceneWarningsSkeleton } from "@/components/title/scene-warnings";
import { TitleCheck, TitleCheckSkeleton } from "@/components/title/title-check";
import { TitleReviews } from "@/components/title/reviews";
import { TitleClubs } from "@/components/title/title-clubs";
import { WhereToWatch, WhereToWatchSkeleton } from "@/components/title/where-to-watch";
import { localizedPath } from "@/core/auth";
import { tmdbImageUrl } from "@/core/catalog/tmdb";
import { isExternalId, isReadingKind, isTitleKind, type Episode } from "@/core/catalog/types";
import type { EntryStatus } from "@/core/collection/entries";
import { countryFromRequest, isCountryCode } from "@/core/countries";
import { shownShare } from "@/core/finish-share";
import { ensureEpisodes, episodeLogs, type SeriesEpisodes as Series } from "@/data/episodes";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";
import { avoidTopicIds, titleWarnings } from "@/data/warnings";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import { GameTitle } from "./game";
import { ReadingTitle } from "./reading";

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/** A series' episode numbers by season, for the scene warning picker. */
function seasonEpisodes(episodes: readonly Episode[]): { season: number; episodes: number[] }[] {
  const bySeason = new Map<number, number[]>();
  for (const e of episodes) bySeason.set(e.season, [...(bySeason.get(e.season) ?? []), e.episode]);
  return [...bySeason.entries()].sort(([a], [b]) => a - b).map(([season, list]) => ({ season, episodes: [...list].sort((a, b) => a - b) }));
}

/**
 * Title detail: a series' seasons and episodes with logging (S1 collection → Series), a book's or manga's reading
 * progress (S2 books & manga), and for movies and series where to watch in the user's country (S2 where to watch)
 * and content warnings (S2 content warnings; `?warnings=1` shows them without avoid-topics chosen), a game's page (S3
 * games), and for every kind our own scene warnings (S3 warnings & quiz), with the pre-watch check against the
 * viewer's avoid-topics on top (stage 4, "Check a title before you watch"). Signed-in only (the proxy sends others to
 * /auth).
 */
export default async function TitlePage({ params, searchParams }: PageProps<"/[locale]/title/[kind]/[id]">) {
  const { locale: raw, kind, id } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  if (!isTitleKind(kind) || !isExternalId(kind, id)) notFound();
  const self = localizedPath(`/title/${kind}/${id}`, locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [t, reading, movie, game] = await Promise.all([
    getTranslations("Series"),
    getTranslations("Reading"),
    getTranslations("Movie"),
    getTranslations("Game"),
  ]);
  let title: Awaited<ReturnType<typeof ensureTitle>> = null;
  let series: Series | null = null;
  let failed = false;
  try {
    title = await ensureTitle(kind, id);
    if (title && kind === "series") series = await ensureEpisodes(title.id, id);
  } catch {
    failed = true; // TMDB is down and nothing is cached
  }
  if (failed && !title) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-10 pb-16">
        <p className="text-muted-foreground">
          {kind === "series" ? t("loadError") : kind === "movie" ? movie("loadError") : kind === "game" ? game("loadError") : reading("loadError")}
        </p>
        <Link href="/collection" className="font-semibold text-brand">
          {t("backToCollection")}
        </Link>
      </main>
    );
  }
  if (!title) notFound();
  if (isReadingKind(title.title.kind)) {
    return <ReadingTitle supabase={supabase} userId={userId} kind={title.title.kind} externalId={id} title={title} />;
  }
  if (title.title.kind === "game") return <GameTitle supabase={supabase} userId={userId} externalId={id} title={title} />;

  const isMovie = title.title.kind === "movie";
  const [{ data: profile }, { data: entry }, logs, requestHeaders, avoid, query] = await Promise.all([
    supabase.from("profiles").select("time_zone, username, country").eq("id", userId).single(),
    supabase.from("entries").select("id, status, finished_at, rating, review, finish_share, finish_members").eq("user_id", userId).eq("title_id", title.id).is("deleted_at", null).maybeSingle(),
    isMovie ? null : episodeLogs(supabase, userId, [title.id]),
    headers(),
    avoidTopicIds(supabase, userId),
    searchParams,
  ]);
  const poster = title.title.posterPath ? tmdbImageUrl(title.title.posterPath, "w342") : null;
  // Where to watch: the saved country, else a guess from this request that is then saved (ADR 0032).
  const savedCountry = isCountryCode(profile?.country) ? profile.country : null;
  const country =
    savedCountry ??
    countryFromRequest({ ipCountry: requestHeaders.get("x-vercel-ip-country"), acceptLanguage: requestHeaders.get("accept-language") });
  const whereToWatch = (
    <Suspense fallback={<WhereToWatchSkeleton />}>
      <WhereToWatch
        titleId={title.id}
        kind={isMovie ? "movie" : "series"}
        externalId={id}
        locale={locale}
        country={country}
        remember={savedCountry || !profile ? undefined : { supabase, userId }}
      />
    </Suspense>
  );

  // One DTDD lookup for the verdict on top and the warnings block (`titleWarnings` is cached per request by `title`).
  const warningTitle = { ...title.title, kind: isMovie ? ("movie" as const) : ("series" as const) };
  const check = (
    <Suspense fallback={<TitleCheckSkeleton kind={title.title.kind} />}>
      <TitleCheck
        supabase={supabase}
        titleId={title.id}
        kind={title.title.kind}
        avoid={avoid}
        dtdd={avoid.length > 0 ? titleWarnings(title.id, warningTitle) : null}
      />
    </Suspense>
  );
  const warnings = (
    <Suspense fallback={<ContentWarningsSkeleton />}>
      <ContentWarnings
        titleId={title.id}
        title={warningTitle}
        avoid={avoid}
        path={`/title/${kind}/${id}`}
        check={query.warnings === "1"}
      />
    </Suspense>
  );
  // Our own scene warnings (S3 warnings & quiz): a series' episode picker starts on the furthest episode logged.
  const seriesLogs = logs?.get(title.id) ?? [];
  const furthest = seriesLogs.reduce<{ season: number; episode: number } | null>(
    (best, l) => (!best || l.season > best.season || (l.season === best.season && l.episode > best.episode) ? { season: l.season, episode: l.episode } : best),
    null,
  );
  const sceneWarnings = (
    <Suspense fallback={<SceneWarningsSkeleton />}>
      <SceneWarnings
        supabase={supabase}
        titleId={title.id}
        kind={title.title.kind}
        avoid={avoid}
        status={(entry?.status as EntryStatus | undefined) ?? null}
        seasons={seasonEpisodes(series?.episodes ?? [])}
        start={furthest}
      />
    </Suspense>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <header className="flex items-center gap-4">
        <span className="relative aspect-[2/3] w-24 shrink-0 -rotate-2 overflow-hidden rounded-lg bg-muted shadow-md ring-4 ring-card">
          {poster && <Image src={poster} alt="" fill unoptimized sizes="96px" className="object-cover" />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.02em]">{title.title.name}</h1>
          <p className="text-sm text-muted-foreground">
            {isMovie
              ? movie("meta", { year: title.title.year ?? "none" })
              : t("meta", { year: title.title.year ?? "none", seasons: title.title.seasonCount ?? 0 })}
          </p>
        </div>
      </header>
      {check}
      {isMovie && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-border">
          <span className="font-semibold">{entry?.status ? movie("status", { status: entry.status }) : movie("notInCollection")}</span>
          <Link
            href={entry?.status ? "/collection" : { pathname: "/collection", query: { add: "1", pick: `movie:${id}` } }}
            className="inline-flex min-h-11 items-center font-semibold text-brand"
          >
            {entry?.status ? movie("openCollection") : movie("addFromCollection")}
          </Link>
        </p>
      )}
      {warnings}
      {sceneWarnings}
      {whereToWatch}
      {/* Offline, quick add offers titles opened lately (S3 offline). */}
      <RememberTitles
        titles={[{ source: "tmdb", kind: title.title.kind, externalId: id, name: title.title.name, ...(title.title.year ? { year: title.title.year } : {}), ...(poster ? { imageUrl: poster } : {}) }]}
      />
      {!isMovie && (
        <SeriesEpisodes
          userId={userId}
          externalId={id}
          episodes={series?.episodes ?? []}
          ended={series?.ended ?? false}
          initialLogs={logs?.get(title.id) ?? []}
          initialStatus={(entry?.status as EntryStatus | undefined) ?? null}
          initialEntry={entry && { id: entry.id, finishedAt: entry.finished_at, rating: entry.rating, review: entry.review, finishShare: shownShare(entry.finish_share, entry.finish_members) }}
          timeZone={profile?.time_zone ?? "UTC"}
          card={{
            kind: "series",
            name: title.title.name,
            year: title.title.year,
            posterUrl: poster,
            genres: title.title.genres,
            runtimeMin: title.title.runtimeMin,
            episodeCount: title.title.episodeCount,
            seasonCount: title.title.seasonCount,
          }}
          username={profile?.username ?? ""}
          host={siteUrl().host}
        />
      )}
      <Suspense fallback={null}>
        <TitleFinishers supabase={supabase} userId={userId} titleId={title.id} />
      </Suspense>
      <Suspense fallback={null}>
        <TitleReviews supabase={supabase} userId={userId} titleId={title.id} />
      </Suspense>
      <TitleClubs title={title.title} />
      <TitleJournal kind={kind} externalId={id} />
    </main>
  );
}
