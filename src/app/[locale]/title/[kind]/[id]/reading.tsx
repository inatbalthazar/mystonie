import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ReadingProgress } from "@/components/reading/reading-progress";
import { posterUrl } from "@/core/catalog/images";
import type { ReadingKind, Title } from "@/core/catalog/types";
import type { EntryStatus } from "@/core/collection/entries";
import { titleReadingLogs } from "@/data/reading";
import type { UserClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/site";

/** A book's or manga's page (S2 books & manga): cover, length and reading progress with logging. */
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
  const [{ data: profile }, { data: entry }, logs] = await Promise.all([
    supabase.from("profiles").select("time_zone, username").eq("id", userId).single(),
    supabase.from("entries").select("id, status, finished_at, rating, review").eq("user_id", userId).eq("title_id", title.id).is("deleted_at", null).maybeSingle(),
    titleReadingLogs(supabase, userId, title.id),
  ]);
  const { name, year, pageCount, chapterCount, volumeCount, genres } = title.title;
  const cover = posterUrl(title.title.source, title.title.posterPath);
  const count = (v: number | null) => v ?? "none";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <Link href="/collection" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand">
        {t("backToCollection")}
      </Link>
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
      <ReadingProgress
        kind={kind}
        externalId={externalId}
        lengths={{ kind, pageCount, chapterCount, volumeCount }}
        initialLogs={logs}
        initialStatus={(entry?.status as EntryStatus | undefined) ?? null}
        initialEntry={entry && { id: entry.id, finishedAt: entry.finished_at, rating: entry.rating, review: entry.review }}
        timeZone={profile?.time_zone ?? "UTC"}
        card={{ kind, name, year, posterUrl: cover, genres, pageCount, chapterCount, volumeCount }}
        username={profile?.username ?? ""}
        host={siteUrl().host}
      />
    </main>
  );
}
