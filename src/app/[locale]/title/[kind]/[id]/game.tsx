import { Gamepad2Icon } from "lucide-react";
import Image from "next/image";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { RememberTitles } from "@/components/offline/recent-titles";
import { TitleFinishers } from "@/components/title/finishers";
import { SceneWarnings, SceneWarningsSkeleton } from "@/components/title/scene-warnings";
import { TitleClubs } from "@/components/title/title-clubs";
import { posterUrl } from "@/core/catalog/images";
import type { Title } from "@/core/catalog/types";
import type { EntryStatus } from "@/core/collection/entries";
import { formatRuntime } from "@/core/format/runtime";
import type { UserClient } from "@/data/supabase-server";
import { avoidTopicIds } from "@/data/warnings";
import { Link } from "@/i18n/navigation";

/**
 * A game's page (S3 games): its key art, year, genres, platforms and RAWG's average playtime, where it stands on the
 * user's Play shelf, our own scene warnings (the only warnings games have), finishers and clubs. Games are added and
 * finished from the collection, as movies are. RAWG is credited here as its terms ask (and in the footer).
 */
export async function GameTitle({
  supabase,
  userId,
  externalId,
  title,
}: {
  supabase: UserClient;
  userId: string;
  externalId: string;
  title: { id: string; title: Title };
}) {
  const [t, format, locale] = await Promise.all([getTranslations("Game"), getFormatter(), getLocale()]);
  const [{ data: profile }, { data: entry }, avoid] = await Promise.all([
    supabase.from("profiles").select("time_zone").eq("id", userId).single(),
    supabase.from("entries").select("status, finished_at, hours_played").eq("user_id", userId).eq("title_id", title.id).is("deleted_at", null).maybeSingle(),
    avoidTopicIds(supabase, userId),
  ]);
  const { name, year, genres, platforms, playtimeHours } = title.title;
  const art = posterUrl(title.title.source, title.title.posterPath);
  const status = (entry?.status as EntryStatus | undefined) ?? null;
  const rawg = (chunks: ReactNode) => (
    <a href={`https://rawg.io/games/${externalId}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
      {chunks}
    </a>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <Link href="/collection" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand">
        {t("backToCollection")}
      </Link>
      <header className="flex flex-col gap-4">
        {/* The key art, landscape as RAWG draws it, taped onto the page. */}
        <div className="relative mx-1 mt-2">
          <span aria-hidden="true" className="absolute -top-3 left-8 z-10 h-6 w-24 rotate-[-6deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/15 dark:bg-brand/40" />
          <span className="relative block aspect-video w-full rotate-[-1deg] overflow-hidden rounded-xl bg-muted shadow-md ring-4 ring-card">
            {art ? (
              <Image src={art} alt="" fill unoptimized priority sizes="(min-width: 672px) 640px, 100vw" className="object-cover" />
            ) : (
              // No art on RAWG: a controller where the cartridge label would be.
              <span className="flex size-full items-center justify-center text-muted-foreground/60">
                <Gamepad2Icon className="size-14" aria-hidden="true" />
              </span>
            )}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.02em] break-words">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {t("meta", { year: year ?? "none" })}
            {genres.length > 0 && ` · ${format.list(genres.slice(0, 3), { type: "unit" })}`}
          </p>
          {platforms.length > 0 && <p className="text-sm text-muted-foreground">{format.list(platforms, { type: "unit" })}</p>}
          {playtimeHours && <p className="text-sm text-muted-foreground">{t("average", { time: formatRuntime(playtimeHours * 60, locale) })}</p>}
        </div>
      </header>

      {/* Where it stands in the collection: the Play shelf's status, the finish date and the hours given. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-border">
        <span className="font-semibold">
          {status === "finished" && entry?.finished_at
            ? t("finishedOn", { date: format.dateTime(new Date(entry.finished_at), { dateStyle: "medium", timeZone: profile?.time_zone ?? "UTC" }) })
            : status
              ? t("status", { status })
              : t("notInCollection")}
          {status === "finished" && entry?.hours_played ? ` · ${t("hoursPlayed", { time: formatRuntime(entry.hours_played * 60, locale) })}` : ""}
        </span>
        <Link
          href={status ? "/collection" : { pathname: "/collection", query: { add: "1", pick: `game:${externalId}` } }}
          className="inline-flex min-h-11 items-center font-semibold text-brand"
        >
          {status ? t("openCollection") : t("addFromCollection")}
        </Link>
      </p>

      {/* Offline, quick add offers titles opened lately (S3 offline). */}
      <RememberTitles
        titles={[
          {
            source: "rawg",
            kind: "game",
            externalId,
            name,
            ...(year ? { year } : {}),
            ...(art ? { imageUrl: art } : {}),
            ...(platforms.length ? { platforms } : {}),
          },
        ]}
      />
      {/* Our own scene warnings (S3 warnings & quiz): the only warnings games have, about the whole game. */}
      <Suspense fallback={<SceneWarningsSkeleton />}>
        <SceneWarnings supabase={supabase} titleId={title.id} kind="game" avoid={avoid} status={status} />
      </Suspense>
      <Suspense fallback={null}>
        <TitleFinishers supabase={supabase} userId={userId} titleId={title.id} />
      </Suspense>
      <TitleClubs title={title.title} />
      <p className="text-xs text-muted-foreground">{t.rich("credit", { rawg })}</p>
    </main>
  );
}
