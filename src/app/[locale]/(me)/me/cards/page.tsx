import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FreshPage } from "@/components/motion/fresh-page";
import { SwipeArea } from "@/components/motion/swipe-area";
import { SharedCardImage } from "@/components/shared-card";
import { localizedPath } from "@/core/auth";
import { recentCards, type UserCard } from "@/data/cards";
import { userClient } from "@/data/supabase-server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

/** Cards shown per step; "Show more" adds another step. */
const STEP = 24;
/** The most steps a URL can ask for at once. */
const MAX_STEPS = 20;

export async function generateMetadata({ params }: PageProps<"/[locale]/me/cards">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "Profile" });
  return { title: `${t("cardsTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Me's Cards tab (ADR 0076): every card you made, shared or only downloaded, newest first, 24 at a time ("Show more",
 * `?steps=`), under Me's cover and tabs (Me's layout, ADR 0081). Only for you: the album (yours and visitors') no longer has a card gallery, and a shared card has its own
 * page (/c/<id>).
 */
export default async function MyCardsPage({ params, searchParams }: PageProps<"/[locale]/me/cards">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const asked = Number((await searchParams).steps);
  const steps = Number.isInteger(asked) && asked > 1 ? Math.min(asked, MAX_STEPS) : 1;
  const self = localizedPath("/me/cards", locale, routing.defaultLocale);

  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!db || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [cards, t] = await Promise.all([
    // One more than shown, to know whether there are more.
    recentCards(db, userId, steps * STEP + 1),
    getTranslations("Profile"),
  ]);
  const shown = cards.slice(0, steps * STEP);
  const more = cards.length > shown.length;
  const host = siteUrl().host;
  const alt = (card: UserCard) =>
    t("cardAlt", {
      name: card.data.reel
        ? t("reelCard", { number: card.data.reel.number })
        : card.data.atlas?.regions
          ? t("atlasRegionsCard", { country: card.data.name })
          : card.data.atlas
            ? t("atlasCard", { count: card.data.atlas.countries.length })
            : card.data.shelf
              ? t("shelfCard", { count: card.data.shelf.titles.length })
              : card.data.milestone
              ? t("milestoneCard")
              : card.data.recap?.highlights
                ? t("yearCard")
                : card.data.recap
                  ? t("recapCard")
                  : card.data.name,
    });

  return (
    <>
      <FreshPage />
      <SwipeArea prev="/stats" next="/me/journal" className="flex flex-col gap-6">
        <section aria-labelledby="my-cards" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="my-cards" className="font-display text-xl font-extrabold">
              {t("cardsTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("cardsIntro")}</p>
          </div>
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-8 text-center">
              <p className="font-hand text-2xl text-muted-foreground">{t("cardsEmpty")}</p>
            </div>
          ) : (
            // Pasted in slightly crooked, like the rest of the album, and dealt in each time they're shown (ADR 0080).
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
              {shown.map((card, i) => {
                const image = (
                  <SharedCardImage
                    imageUrl={card.imageUrl}
                    alt={alt(card)}
                    templateId={card.templateId}
                    size={card.size}
                    data={card.data}
                    host={host}
                    lazy
                  />
                );
                return (
                  <Reveal
                    as="li"
                    key={card.id}
                    className={cn("deal", i % 3 === 1 ? "rotate-[1.2deg]" : i % 3 === 2 ? "rotate-[-0.8deg]" : "rotate-[-1.6deg]")}
                    style={{ ["--grow-delay" as string]: `${(i % 3) * 80}ms` }}
                  >
                    {card.sharedAt ? (
                      <Link
                        href={`/c/${card.id}`}
                        className="block rounded-lg shadow-[0_2px_4px_rgb(0_0_0/0.08),0_14px_28px_-16px_rgb(0_0_0/0.45)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {image}
                      </Link>
                    ) : (
                      <div className="relative rounded-lg shadow-[0_2px_4px_rgb(0_0_0/0.08),0_14px_28px_-16px_rgb(0_0_0/0.45)]">
                        {image}
                        <span className="absolute top-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground backdrop-blur">
                          {t("cardsNotShared")}
                        </span>
                      </div>
                    )}
                  </Reveal>
                );
              })}
            </ul>
          )}
          {more && steps < MAX_STEPS && (
            <Link
              href={{ pathname: "/me/cards", query: { steps: steps + 1 } }}
              scroll={false}
              replace
              className="flex h-12 items-center justify-center self-center rounded-full bg-card px-6 font-semibold shadow-sm ring-1 ring-border hover:bg-muted press"
            >
              {t("cardsMore")}
            </Link>
          )}
        </section>
      </SwipeArea>
    </>
  );
}
