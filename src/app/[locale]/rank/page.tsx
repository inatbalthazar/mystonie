import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { loadCard } from "@/app/[locale]/c/[id]/load";
import { RankMaker } from "@/components/rank/rank-maker";
import { localizedPath } from "@/core/auth";
import { isUuidV7 } from "@/core/ids";
import { remixRanking } from "@/core/rankings";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Rank");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Make a ranking (ADR 0099): a Top 3, 5 or 10 or a tier list of anything, titles of every kind and places, made into a
 * card to share. Signed in only: the card carries your name, and the ✓ marks come from your collection and Atlas.
 * `?from=<card id>` starts from a shared ranking's things (step 4, remix).
 */
export default async function RankPage({ params, searchParams }: PageProps<"/[locale]/rank">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const from = (await searchParams).from;
  const fromId = typeof from === "string" && isUuidV7(from) ? from : null;
  const self = localizedPath(fromId ? `/rank?from=${fromId}` : "/rank", locale, routing.defaultLocale);
  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!db || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });
  const [{ data: profile }, t, shared] = await Promise.all([
    db.from("profiles").select("username").eq("id", userId).maybeSingle(),
    getTranslations("Rank"),
    fromId ? loadCard(fromId) : null,
  ]);
  const remix = shared?.data.ranking ? { name: shared.data.name, ranking: remixRanking(shared.data.ranking) } : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-1">
        <p className="font-hand text-2xl leading-none text-muted-foreground">{t("kicker")}</p>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("intro")}</p>
      </header>
      <RankMaker username={profile?.username ?? null} host={siteUrl().host} remix={remix} />
    </main>
  );
}
