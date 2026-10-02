import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ReportButton } from "@/components/report-button";
import { RememberCardVisit, SharedCardImage } from "@/components/shared-card";
import { countryName } from "@/core/countries";
import type { SharedCard } from "@/data/cards";
import { Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/site";
import { loadCard } from "./load";

/** "Finished Parasite" / "Stranger Things · Halfway there": the card's line, for the title and alt text. */
async function cardLine(card: SharedCard, locale: Locale): Promise<string> {
  const t = await getTranslations({ locale, namespace: "SharedCard" });
  const tc = await getTranslations({ locale, namespace: "Card" });
  if (card.data.reel) return t("reelLine", { number: card.data.reel.number });
  if (card.data.atlas?.regions) {
    const { country, kind, total, ids } = card.data.atlas.regions;
    const atlas = await getTranslations({ locale, namespace: "Atlas" });
    return t("atlasRegionsLine", { done: ids.length, total, many: atlas("kindMany", { kind }), country: countryName(country, locale) });
  }
  if (card.data.atlas) return t("atlasLine", { count: card.data.atlas.countries.length });
  const recap = card.data.recap;
  if (recap) {
    const format = await getFormatter({ locale });
    const day = (key: string) => new Date(`${key}T00:00:00Z`);
    const year = recap.period && recap.period !== "week" ? "numeric" : undefined;
    const range = format.dateTimeRange(day(recap.from), day(recap.to), { month: "short", day: "numeric", year, timeZone: "UTC" });
    return recap.imported
      ? t("importLine", { count: recap.titleCount, unit: recap.importedUnit ?? "film", range })
      : t("recapLine", { period: recap.period ?? "week", range });
  }
  const p = card.data.progress;
  if (!p) return t("finishedLine", { name: card.data.name });
  const where = p.milestone ? tc("milestone", { milestone: p.milestone }) : tc("episodeCode", { season: p.season, episode: p.episode });
  return t("progressLine", { name: card.data.name, where });
}

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[id]">): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const locale = raw as Locale;
  const t = await getTranslations({ locale, namespace: "SharedCard" });
  const card = await loadCard(id);
  if (!card) return { title: t("notFoundTitle"), robots: { index: false } };
  const title = await cardLine(card, locale);
  const description = card.data.username ? t("descriptionBy", { username: card.data.username }) : t("description");
  return {
    title: `${title} · Mystonie`,
    description,
    // Shared on purpose, but a person's cards shouldn't show up in search results.
    robots: { index: false, follow: true },
    alternates: { canonical: `/c/${card.id}` },
    openGraph: { type: "article", title, description, url: `/c/${card.id}`, siteName: "Mystonie" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * A shared card (S1 share artwork): the link that travels with every share. Public, even for private
 * profiles: sharing is an explicit publish. The CTA turns viewers into card makers.
 */
export default async function SharedCardPage({ params }: PageProps<"/[locale]/c/[id]">) {
  const { locale: raw, id } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const card = await loadCard(id);
  if (!card) notFound();

  const [t, tc, format] = await Promise.all([getTranslations("SharedCard"), getTranslations("Card"), getFormatter()]);
  const { data } = card;
  const [y, m, d] = data.finishedOn.split("-").map(Number);
  const date = format.dateTime(new Date(Date.UTC(y!, m! - 1, d!)), { dateStyle: "medium", timeZone: "UTC" });
  const line = await cardLine(card, locale);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <p className="text-center font-hand text-2xl text-muted-foreground">
        {data.username && card.profileUsername
          ? t.rich("byUserLink", {
              username: data.username,
              link: (chunks) => (
                <Link
                  href={`/u/${card.profileUsername}`}
                  className="text-foreground underline decoration-brand/60 underline-offset-4 hover:decoration-brand"
                >
                  {chunks}
                </Link>
              ),
            })
          : data.username
            ? t("byUser", { username: data.username })
            : t("byNobody")}
      </p>

      {/* Pasted into the album: a slight tilt and two strips of tape. */}
      <div className="relative mx-auto w-full max-w-[20rem] rotate-[-1.5deg]">
        <span
          aria-hidden="true"
          className="absolute -top-3 left-6 z-10 h-6 w-20 rotate-[-8deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/15 dark:bg-brand/30"
        />
        <span
          aria-hidden="true"
          className="absolute -top-3 right-6 z-10 h-6 w-16 rotate-[6deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/15 dark:bg-brand/30"
        />
        <div
          className={
            card.kind === "sticker"
              ? "rounded-xl bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:20px_20px] shadow-xl ring-1 ring-border"
              : "rounded-xl shadow-[0_2px_4px_rgb(0_0_0/0.08),0_24px_48px_-20px_rgb(0_0_0/0.45)]"
          }
        >
          <SharedCardImage
            imageUrl={card.imageUrl}
            alt={t("imageAlt", { line })}
            templateId={card.templateId}
            size={card.size}
            data={data}
            host={siteUrl().host}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-balance">{line}</h1>
        <p className="text-sm text-muted-foreground">
          {data.recap ? (
            `${tc("titlesWatched", { count: data.recap.titleCount, period: data.recap.period ?? "week" })} · ${data.recap.titles.map((title) => title.name).join(", ")}`
          ) : (
            <>
              {tc("kind", { kind: data.kind })}
              {data.year ? ` · ${data.year}` : ""}
              {" · "}
              {date}
            </>
          )}
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-border px-5 py-6 text-center">
        <p className="font-display text-xl font-extrabold">{t("ctaTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("ctaBody")}</p>
        <Link
          href={{ pathname: "/", query: { ref: "card", tpl: card.templateId } }}
          className="flex h-12 items-center justify-center rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
        >
          {t("makeYourOwn")}
        </Link>
        <Link href="/auth" className="flex h-11 items-center justify-center rounded-full font-semibold ring-1 ring-border hover:bg-muted press">
          {t("startCollection")}
        </Link>
      </section>
      <ReportButton targetKind="card" targetId={card.id} className="self-center" />
      <RememberCardVisit tpl={card.templateId} />
    </main>
  );
}
