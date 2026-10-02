import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "next-intl";
import { ExampleCards } from "@/cards/example-cards";
import { CARD_FIXTURES } from "@/cards/fixtures";
import { FeaturePages, KindTape, type ShowTitle } from "@/components/landing/feature-pages";
import { TitlePicker } from "@/components/title-picker";
import { Link } from "@/i18n/navigation";
import { tmdbImageUrl } from "@/core/catalog/tmdb";
import type { SearchResult } from "@/core/catalog/types";
import type { CardData } from "@/core/cards/types";
import { titleDetails, trendingTitles } from "@/data/tmdb";
import { siteUrl } from "@/lib/site";

// Trending changes daily; rebuild the page at most hourly.
export const revalidate = 3600;

async function loadTrending(): Promise<SearchResult[]> {
  try {
    return await trendingTitles();
  } catch (error) {
    // No token at build time, or TMDB down: the page still works with search only.
    console.warn(`Trending unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/** Example cards: the top trending titles with real stats, or one sample without a poster. */
async function loadExamples(trending: SearchResult[], sample: CardData): Promise<CardData[]> {
  const finishedOn = new Date().toISOString().slice(0, 10);
  const top = trending.filter((r) => r.kind === "movie" || r.kind === "series").slice(0, 3);
  const cards = await Promise.all(
    top.map(async (r, i): Promise<CardData | null> => {
      const details = await titleDetails(r.kind as "movie" | "series", r.externalId).catch(() => null);
      if (!details) return null;
      const { title } = details;
      return {
        ...title,
        // Small posters: examples render at thumbnail size on the first screen.
        posterUrl: title.posterPath ? tmdbImageUrl(title.posterPath, "w342") : null,
        finishedOn,
        rating: i === 1 ? 4.5 : null,
        review: i === 1 ? sample.review : null,
      };
    }),
  );
  const found = cards.filter((c): c is CardData => c !== null);
  return found.length > 0 ? found : [{ ...sample, finishedOn }];
}

/**
 * The titles the tour's pictures borrow: this week's trending ones (posters at list size), or the card lab's when
 * trending is down, so the pictures never sit empty.
 */
function showTitles(trending: SearchResult[]): ShowTitle[] {
  const found = trending.filter((r) => r.imageUrl).slice(3, 8).map((r) => ({ name: r.name, posterUrl: r.imageUrl ?? null }));
  if (found.length >= 5) return found;
  const seen = new Set<string>();
  const fixtures = CARD_FIXTURES.map((f) => f.data).filter((d) => d.posterUrl && !seen.has(d.name) && seen.add(d.name));
  return [...found, ...fixtures.map((d) => ({ name: d.name, posterUrl: d.posterUrl! }))].slice(0, 5);
}

const heroButton =
  "mt-3 hidden h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, tc, ts, trending] = await Promise.all([getTranslations("Home"), getTranslations("Card"), getTranslations("SignUp"), loadTrending()]);
  const host = siteUrl().host;
  const examples = await loadExamples(trending, {
    kind: "series",
    name: tc("sampleTitle"),
    episodeCount: 16,
    seasonCount: 1,
    runtimeMin: 60,
    rating: 4.5,
    review: tc("sampleReview"),
    finishedOn: "",
  });

  return (
    <main className="flex flex-1 flex-col items-center gap-10 overflow-x-clip px-4 pt-8 pb-16">
      <section className="flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="font-display text-[2.75rem] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
          {t.rich("headline", { mark: (chunks) => <span className="text-brand">{chunks}</span> })}
        </h1>
        <p className="max-w-sm text-lg text-muted-foreground text-balance">{t("intro")}</p>
        <KindTape />
        {/* The way in (ADR 0071); signed in, the way back to the collection. CSS picks one, so the page stays static. */}
        <Link href="/auth" className={`${heroButton} signed-out:inline-flex`}>
          {ts("hero")}
        </Link>
        <Link href="/home" className={`${heroButton} signed-in:inline-flex`}>
          {ts("heroSignedIn")}
        </Link>
        <p className="hidden text-sm text-muted-foreground signed-out:block">{t("heroNote")}</p>
      </section>
      <ExampleCards examples={examples} host={host} />
      {/* The tour: what the app does, one scrapbook page each. */}
      <div className="mt-8 flex w-full justify-center">
        <FeaturePages titles={showTitles(trending)} />
      </div>
      {/* The card maker, for trying it without an account; the way in sits under it (ADR 0071). */}
      <section id="make" aria-labelledby="make-title" className="mt-12 flex w-full max-w-2xl scroll-mt-6 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 id="make-title" className="font-display text-[2.125rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance sm:text-[2.5rem]">
            {t.rich("makeTitle", { mark: (chunks) => <span className="text-brand">{chunks}</span> })}
          </h2>
          <p className="max-w-[40ch] text-base text-pretty text-muted-foreground">{t("makeBody")}</p>
        </div>
        <TitlePicker trending={trending.slice(0, 12)} host={host} />
      </section>
    </main>
  );
}
