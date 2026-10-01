import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegionsView } from "@/components/atlas/regions-view";
import { regionsOf } from "@/core/atlas-regions";
import { localizedPath } from "@/core/auth";
import { countryName, isCountryCode, type CountryCode } from "@/core/countries";
import { userPlaces, userRegions } from "@/data/atlas";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

/** `jp` → `JP` when it's a country with regions, else null. */
function countryOf(param: string): CountryCode | null {
  const code = param.toUpperCase();
  return isCountryCode(code) && regionsOf(code) ? code : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/collection/atlas/[country]">): Promise<Metadata> {
  const { locale, country } = await params;
  const code = countryOf(country);
  const t = await getTranslations("Atlas");
  return { title: `${code ? countryName(code, locale) : t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * One country of the Atlas (stage 4, ADR 0060): its states, provinces or regions on its own map, marked one tap at a
 * time. Opened from the country's sheet; `/collection/atlas/jp`. Only countries with regions (not the ones drawn as a
 * dot on the world map).
 */
export default async function AtlasCountryPage({ params }: PageProps<"/[locale]/collection/atlas/[country]">) {
  const { locale: raw, country: param } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const country = countryOf(param);
  if (!country) notFound();
  if (param !== country.toLowerCase()) return redirect({ href: `/collection/atlas/${country.toLowerCase()}`, locale });
  const self = `/collection/atlas/${country.toLowerCase()}`;

  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!db || !userId) return redirect({ href: { pathname: "/auth", query: { next: localizedPath(self, locale, routing.defaultLocale) } }, locale });

  const [{ data: profile, error }, places, marked] = await Promise.all([
    db.from("profiles").select("username").eq("id", userId).single(),
    userPlaces(db, userId),
    userRegions(db, userId, country),
  ]);
  if (error) throw new Error(`profile read failed: ${error.message}`);
  const regions = regionsOf(country)!;
  const name = countryName(country, locale);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-4 pt-6 pb-28">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{name}</h1>
      <div className="mt-2">
        <RegionsView
          country={country}
          name={name}
          kind={regions.kind}
          total={regions.ids.length}
          initialMarked={marked}
          initialPlace={places.find((p) => p.country === country) ?? null}
          username={profile.username}
          host={siteUrl().host}
        />
      </div>
    </main>
  );
}
