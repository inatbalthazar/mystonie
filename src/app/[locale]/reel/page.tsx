import type { Metadata } from "next";
import Image from "next/image";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaperCard } from "@/components/paper-card";
import { ReelGame } from "@/components/reel/reel-game";
import { reelDay, reelNumber } from "@/core/reel";
import { yesterdaysReel } from "@/data/reel";
import { userClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Reel");
  return { title: `${t("metaTitle")} · Mystonie`, description: t("metaDescription"), alternates: { canonical: "/reel" } };
}

/**
 * Reel of the Day (stage 4 daily game, ADR 0048): today's game for everyone, signed in or not, then yesterday's
 * answer and how it works. The game itself loads in the browser (`POST /api/reel`), which also picks the day's reel.
 */
export default async function ReelPage({ params }: PageProps<"/[locale]/reel">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const day = reelDay(Date.now());
  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub ?? null;
  const [profile, yesterday, t] = await Promise.all([
    supabase && userId ? supabase.from("profiles").select("username").eq("id", userId).single().then((r) => r.data) : null,
    yesterdaysReel(day),
    getTranslations("Reel"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-10 pb-16">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-hand text-2xl leading-none text-muted-foreground">{t("kicker")}</p>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        </div>
        <span className="shrink-0 rotate-[4deg] rounded-full bg-brand-soft px-3 py-1 font-display text-lg font-extrabold text-brand ring-1 ring-brand/30">
          {t("number", { number: reelNumber(day) })}
        </span>
      </header>
      <p className="-mt-2 text-muted-foreground">{t("intro")}</p>

      <ReelGame key={day} day={day} number={reelNumber(day)} signedIn={!!userId} username={profile?.username ?? null} host={siteUrl().host} />

      {yesterday && (
        <PaperCard className="flex items-center gap-4">
          <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border">
            {yesterday.posterUrl && <Image src={yesterday.posterUrl} alt="" fill unoptimized sizes="56px" className="object-cover" />}
          </div>
          <div className="flex min-w-0 flex-col">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">
              {t("yesterday", { number: yesterday.number })}
            </h2>
            <Link href={`/title/movie/${yesterday.answer.externalId}`} className="truncate font-display text-lg font-extrabold hover:underline">
              {yesterday.answer.name}
              {yesterday.answer.year ? ` (${yesterday.answer.year})` : ""}
            </Link>
          </div>
        </PaperCard>
      )}

      <section aria-labelledby="reel-how" className="flex flex-col gap-1 text-sm text-muted-foreground">
        <h2 id="reel-how" className="font-semibold text-foreground">
          {t("howTitle")}
        </h2>
        <p>{t("how")}</p>
      </section>
    </main>
  );
}
