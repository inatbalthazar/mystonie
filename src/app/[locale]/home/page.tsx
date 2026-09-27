import type { Metadata } from "next";
import Image from "next/image";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PushPrompt } from "@/components/pwa/push";
import { RecapNote } from "@/components/recap-note";
import { UpNext, type UpNextSeries } from "@/components/series/up-next";
import { SharedCardImage, SignupFromCard } from "@/components/shared-card";
import { localizedPath } from "@/core/auth";
import type { SearchResult } from "@/core/catalog/types";
import { recentCards } from "@/data/cards";
import { listCollection } from "@/data/entries";
import { cachedEpisodes, episodeLogs } from "@/data/episodes";
import { pushConfig } from "@/data/push";
import { latestRecap } from "@/data/recaps";
import { userClient } from "@/data/supabase-server";
import { trendingTitles } from "@/data/tmdb";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

const RECENT_CARDS = 6;
const TRENDING = 9;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomeApp");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/** Trending never blocks Home: no token, or TMDB down, just hides the section. */
async function loadTrending(): Promise<SearchResult[]> {
  try {
    return (await trendingTitles()).filter((r) => r.kind === "movie" || r.kind === "series").slice(0, TRENDING);
  } catch (error) {
    console.warn(`Trending unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Home (signed-in landing, S1 collection): the week's recap note, the next episode of every series being watched,
 * the user's recent cards and what's trending (one tap into quick add). Also offers installing the app and, once
 * installed, recap notifications (ADR 0028).
 */
export default async function HomePage({ params }: PageProps<"/[locale]/home">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/home", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [{ data: profile }, items, cards, recap, trending, t, format] = await Promise.all([
    supabase.from("profiles").select("time_zone, username, display_name, created_at").eq("id", userId).single(),
    listCollection(supabase, userId),
    recentCards(supabase, userId, RECENT_CARDS).catch((error: unknown) => {
      console.error(error);
      return [];
    }),
    latestRecap(supabase, userId).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    loadTrending(),
    getTranslations("HomeApp"),
    getFormatter(),
  ]);

  // "Up next": series being watched whose episodes are cached (quick add caches them after adding).
  const watching = items.filter((i) => i.status === "watching" && i.title.kind === "series" && i.title.id);
  const ids = watching.map((i) => i.title.id!);
  const [episodes, logs] = await Promise.all([cachedEpisodes(supabase, ids), episodeLogs(supabase, userId, ids)]);
  const upNext: UpNextSeries[] = watching.map((i) => ({
    externalId: i.title.externalId,
    name: i.title.name,
    posterUrl: i.title.posterUrl,
    episodes: episodes.get(i.title.id!) ?? [],
    logs: logs.get(i.title.id!) ?? [],
  }));
  const timeZone = profile?.time_zone ?? "UTC";
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  // Sign-in lands here: an account made in the last few minutes is a sign-up (signup_from_card).
  const newAccount = !!profile && now - Date.parse(profile.created_at) < 15 * 60 * 1000;
  const name = profile?.display_name || profile?.username || "";
  const publicKey = pushConfig()?.publicKey;
  const host = siteUrl().host;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <SignupFromCard newAccount={newAccount} />
      <header className="flex flex-col gap-1">
        <p className="font-hand text-2xl leading-none text-muted-foreground">
          {format.dateTime(now, { weekday: "long", month: "long", day: "numeric", timeZone })}
        </p>
        <h1 className={`font-display font-extrabold tracking-[-0.03em] break-words ${[...name].length > 12 ? "text-3xl" : "text-4xl"}`}>
          {name ? t("greeting", { name }) : t("title")}
        </h1>
      </header>

      <InstallPrompt />
      {publicKey && <PushPrompt publicKey={publicKey} />}
      {recap && <RecapNote recap={recap} />}
      <UpNext series={upNext} timeZone={timeZone} />

      <section aria-labelledby="recent-cards" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="recent-cards" className="font-display text-xl font-extrabold">
            {t("recentCards")}
          </h2>
          {cards.some((c) => c.sharedAt) && profile && (
            <Link href={`/u/${profile.username}`} className="flex min-h-11 items-center text-sm font-semibold text-brand">
              {t("seeProfile")}
            </Link>
          )}
        </div>
        {cards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-8 text-center">
            <p className="font-hand text-2xl text-muted-foreground">{t("recentCardsEmpty")}</p>
            <Link
              href={{ pathname: "/collection", query: { add: "1" } }}
              className="flex h-12 items-center rounded-2xl bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90"
            >
              {t("addFirst")}
            </Link>
          </div>
        ) : (
          // A strip of cards pasted in slightly crooked; swipe sideways on a phone.
          <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-1 pb-3">
            {cards.map((card, i) => {
              const image = (
                <SharedCardImage
                  imageUrl={card.imageUrl}
                  alt={t("cardAlt", { name: card.data.recap ? t("recapCard") : card.data.name })}
                  templateId={card.templateId}
                  size={card.size}
                  data={card.data}
                  host={host}
                />
              );
              return (
                <li key={card.id} className={`w-[40%] shrink-0 snap-start sm:w-[30%] ${i % 2 ? "rotate-[1.2deg]" : "rotate-[-1.2deg]"}`}>
                  {card.sharedAt ? (
                    <Link href={`/c/${card.id}`} className="block rounded-lg shadow-md transition-transform hover:-translate-y-0.5">
                      {image}
                    </Link>
                  ) : (
                    <div className="rounded-lg shadow-md">{image}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {trending.length > 0 && (
        <section aria-labelledby="trending" className="flex flex-col gap-3">
          <div>
            <h2 id="trending" className="font-display text-xl font-extrabold">
              {t("trending")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("trendingHint")}</p>
          </div>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-4">
            {trending.map((r, i) => (
              <li key={`${r.kind}-${r.externalId}`} className={i % 2 ? "rotate-[1deg]" : "rotate-[-1deg]"}>
                {/* Straight to the status step of quick add: two taps to a finished title. */}
                <Link
                  href={{ pathname: "/collection", query: { add: "1", pick: `${r.kind}:${r.externalId}` } }}
                  aria-label={t("addTitle", { name: r.name })}
                  className="group block"
                >
                  <span className="relative block aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5">
                    {r.imageUrl && <Image src={r.imageUrl} alt="" fill unoptimized sizes="120px" className="object-cover" />}
                  </span>
                  <span className="mt-1.5 line-clamp-2 text-xs font-medium">{r.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
