import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RememberTitles } from "@/components/offline/recent-titles";
import { ReadingProgress } from "@/components/reading/reading-progress";
import { TitleJournal } from "@/components/journal/title-journal";
import { TitleFinishers } from "@/components/title/finishers";
import { SceneWarnings, SceneWarningsSkeleton } from "@/components/title/scene-warnings";
import { TitleCheck, TitleCheckSkeleton } from "@/components/title/title-check";
import { TitleReviews } from "@/components/title/reviews";
import { TitleClubs } from "@/components/title/title-clubs";
import { posterUrl } from "@/core/catalog/images";
import type { ReadingKind, Title } from "@/core/catalog/types";
import type { EntryStatus } from "@/core/collection/entries";
import { titleReadingLogs } from "@/data/reading";
import type { UserClient } from "@/data/supabase-server";
import { avoidTopicIds } from "@/data/warnings";
import { siteUrl } from "@/lib/site";

/** A book's or manga's page (S2 books & manga): cover, length, reading progress with logging and scene warnings (S3). */
export async function ReadingTitle({
  supabase,
  userId,
  kind,
  externalId,
  title,
}: {
  supabase: UserClient;
  userId: string;
  kind: ReadingKind;
  externalId: string;
  title: { id: string; title: Title };
}) {
  const t = await getTranslations("Reading");
  const [{ data: profile }, { data: entry }, logs, avoid] = await Promise.all([
    supabase.from("profiles").select("time_zone, username").eq("id", userId).single(),
    supabase.from("entries").select("id, status, finished_at, rating, review, finisher_no").eq("user_id", userId).eq("title_id", title.id).is("deleted_at", null).maybeSingle(),
    titleReadingLogs(supabase, userId, title.id),
    avoidTopicIds(supabase, userId),
  ]);
  const { name, year, pageCount, chapterCount, volumeCount, genres } = title.title;
  const cover = posterUrl(title.title.source, title.title.posterPath);
  const count = (v: number | null) => v ?? "none";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <header className="flex items-center gap-4">
        <span className="relative aspect-[2/3] w-24 shrink-0 -rotate-2 overflow-hidden rounded-lg bg-muted shadow-md ring-4 ring-card">
          {cover && <Image src={cover} alt="" fill unoptimized sizes="96px" className="object-cover" />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.02em] break-words">{name}</h1>
          <p className="text-sm text-muted-foreground">{t("meta", { kind, year: year ?? "none" })}</p>
          <p className="text-sm text-muted-foreground">
            {t("length", { kind, pages: count(pageCount), chapters: count(chapterCount), volumes: count(volumeCount) })}
          </p>
        </div>
      </header>
      <Suspense fallback={<TitleCheckSkeleton kind={kind} />}>
        <TitleCheck supabase={supabase} titleId={title.id} kind={kind} avoid={avoid} dtdd={null} />
      </Suspense>
      {/* Offline, quick add offers titles opened lately (S3 offline). */}
      <RememberTitles
        titles={[{ source: title.title.source, kind, externalId, name, ...(year ? { year } : {}), ...(cover ? { imageUrl: cover } : {}) }]}
      />
      <ReadingProgress
        userId={userId}
        kind={kind}
        externalId={externalId}
        lengths={{ kind, pageCount, chapterCount, volumeCount }}
        initialLogs={logs}
        initialStatus={(entry?.status as EntryStatus | undefined) ?? null}
        initialEntry={entry && { id: entry.id, finishedAt: entry.finished_at, rating: entry.rating, review: entry.review, finisherNo: entry.finisher_no }}
        timeZone={profile?.time_zone ?? "UTC"}
        card={{ kind, name, year, posterUrl: cover, genres, pageCount, chapterCount, volumeCount }}
        username={profile?.username ?? ""}
        host={siteUrl().host}
      />
      {/* Our own scene warnings (S3 warnings & quiz): the only warnings books and manga have. */}
      <Suspense fallback={<SceneWarningsSkeleton />}>
        <SceneWarnings supabase={supabase} titleId={title.id} kind={kind} avoid={avoid} status={(entry?.status as EntryStatus | undefined) ?? null} />
      </Suspense>
      <Suspense fallback={null}>
        <TitleFinishers supabase={supabase} userId={userId} titleId={title.id} />
      </Suspense>
      <Suspense fallback={null}>
        <TitleReviews supabase={supabase} userId={userId} titleId={title.id} />
      </Suspense>
      <TitleClubs title={title.title} />
      <TitleJournal kind={kind} externalId={externalId} />
    </main>
  );
}
