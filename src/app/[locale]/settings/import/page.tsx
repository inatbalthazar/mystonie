import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImportFlow } from "@/components/import/import-flow";
import { localizedPath } from "@/core/auth";
import { isImportSource } from "@/core/import/items";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Import");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Import (S2 Letterboxd import, S3 import & export, ADR 0041): an export from Letterboxd, Goodreads, MyAnimeList,
 * TV Time or Mystonie is read in the browser, previewed, then saved. `?from=` picks whose instructions show first.
 */
export default async function ImportPage({ params, searchParams }: PageProps<"/[locale]/settings/import">) {
  const locale = (await params).locale as Locale;
  const from = (await searchParams).from;
  setRequestLocale(locale);
  const self = localizedPath("/settings/import", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = auth?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).single();
  return <ImportFlow username={profile?.username ?? null} host={siteUrl().host} from={isImportSource(from) ? from : "letterboxd"} />;
}
