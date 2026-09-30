import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RecapCelebration } from "@/components/recap-celebration";
import { localizedPath } from "@/core/auth";
import { isUuidV7 } from "@/core/ids";
import { recapCardData } from "@/core/stats/recap";
import { userRecap } from "@/data/recaps";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Recap");
  return { title: `${t("pageTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * One of the user's weekly or monthly recaps (ADR 0025, 0031), opened from the recap email, a notification or
 * Home: the celebration with the recap card, ready to share. Only the owner can open it (RLS).
 */
export default async function RecapPage({ params }: PageProps<"/[locale]/recap/[id]">) {
  const { locale: raw, id } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const self = localizedPath(`/recap/${id}`, locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });
  if (!isUuidV7(id)) notFound();

  const [recap, { data: profile }, t] = await Promise.all([
    userRecap(supabase, id).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    supabase.from("profiles").select("username").eq("id", userId).single(),
    getTranslations("Recap"),
  ]);
  if (!recap) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-10">
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <RecapCelebration data={recapCardData(recap.recap)} recapId={recap.id} username={profile?.username ?? null} host={siteUrl().host} />
    </main>
  );
}
