import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SeriesEpisodes } from "@/components/series/series-episodes";
import { localizedPath } from "@/core/auth";
import { tmdbImageUrl } from "@/core/catalog/tmdb";
import type { EntryStatus } from "@/core/collection/entries";
import { ensureEpisodes, episodeLogs, type SeriesEpisodes as Series } from "@/data/episodes";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/**
 * Title detail (S1 collection → Series): seasons and episodes with logging. Series only for now; movie
 * pages come with the title-detail work. Signed-in only (the proxy sends others to /auth).
 */
export default async function TitlePage({ params }: PageProps<"/[locale]/title/[kind]/[id]">) {
  const { locale: raw, kind, id } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  if (kind !== "series" || !/^\d{1,10}$/.test(id)) notFound();
  const self = localizedPath(`/title/${kind}/${id}`, locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const t = await getTranslations("Series");
  let title: Awaited<ReturnType<typeof ensureTitle>> = null;
  let series: Series | null = null;
  let failed = false;
  try {
    title = await ensureTitle("series", id);
    if (title) series = await ensureEpisodes(title.id, id);
  } catch {
    failed = true; // TMDB is down and nothing is cached
  }
  if (failed && !title) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-10 pb-16">
        <p className="text-muted-foreground">{t("loadError")}</p>
        <Link href="/collection" className="font-semibold text-brand">
          {t("backToCollection")}
        </Link>
      </main>
    );
  }
  if (!title) notFound();

  const [{ data: profile }, { data: entry }, logs] = await Promise.all([
    supabase.from("profiles").select("time_zone, username").eq("id", userId).single(),
    supabase.from("entries").select("id, status, finished_at, rating, review").eq("user_id", userId).eq("title_id", title.id).is("deleted_at", null).maybeSingle(),
    episodeLogs(supabase, userId, [title.id]),
  ]);
  const poster = title.title.posterPath ? tmdbImageUrl(title.title.posterPath, "w342") : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <Link href="/collection" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand">
        {t("backToCollection")}
      </Link>
      <header className="flex items-center gap-4">
        <span className="relative aspect-[2/3] w-24 shrink-0 -rotate-2 overflow-hidden rounded-lg bg-muted shadow-md ring-4 ring-card">
          {poster && <Image src={poster} alt="" fill unoptimized sizes="96px" className="object-cover" />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.02em]">{title.title.name}</h1>
          <p className="text-sm text-muted-foreground">
            {t("meta", { year: title.title.year ?? "none", seasons: title.title.seasonCount ?? 0 })}
          </p>
        </div>
      </header>
      <SeriesEpisodes
        externalId={id}
        episodes={series?.episodes ?? []}
        ended={series?.ended ?? false}
        initialLogs={logs.get(title.id) ?? []}
        initialStatus={(entry?.status as EntryStatus | undefined) ?? null}
        initialEntry={entry && { id: entry.id, finishedAt: entry.finished_at, rating: entry.rating, review: entry.review }}
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
    </main>
  );
}
