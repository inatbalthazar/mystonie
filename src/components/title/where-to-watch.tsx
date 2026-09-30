import type { SupabaseClient } from "@supabase/supabase-js";
import Image from "next/image";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { tmdbImageUrl, type TmdbKind } from "@/core/catalog/tmdb";
import { JUSTWATCH_URL, OFFER_GROUPS, tmdbWatchUrl } from "@/core/catalog/watch-providers";
import { countryName, countryOptions, type CountryCode } from "@/core/countries";
import type { Database } from "@/data/database.types";
import { countryOffers } from "@/data/watch-providers";
import { PaperCard } from "../paper-card";
import { CountryPicker } from "./country-picker";

type Props = {
  titleId: string;
  kind: TmdbKind;
  externalId: string;
  locale: string;
  /** The profile's country, else the request's best guess (null when there is none). */
  country: CountryCode | null;
  /** Set when `country` is a guess: it is saved to this user's profile, which is where it's edited from then on. */
  remember?: { supabase: SupabaseClient<Database>; userId: string };
};

function Frame({ title, children, country, locale }: { title: string; children: ReactNode; country: CountryCode | null; locale: string }) {
  return (
    <PaperCard className="flex flex-col gap-4 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <CountryPicker country={country} options={countryOptions(locale)} />
      </div>
      {children}
    </PaperCard>
  );
}

/**
 * S2 where to watch: the services carrying a movie or series in the user's country (TMDB watch providers, data by
 * JustWatch, credited here as TMDB requires). Each logo opens TMDB's watch page for that country, which has the
 * deep links into each service. Rendered inside Suspense: the TMDB call never holds up the page.
 */
export async function WhereToWatch({ titleId, kind, externalId, locale, country, remember }: Props) {
  const t = await getTranslations("WhereToWatch");
  if (!country) {
    return (
      <Frame title={t("title")} country={null} locale={locale}>
        <p className="text-sm text-muted-foreground">{t("pickCountry")}</p>
      </Frame>
    );
  }

  const [result] = await Promise.all([
    countryOffers(titleId, kind, externalId, country),
    remember && remember.supabase.from("profiles").update({ country }).eq("id", remember.userId).is("country", null),
  ]);
  const name = countryName(country, locale);
  const link = tmdbWatchUrl(kind, externalId, country);

  return (
    <Frame title={t("title")} country={country} locale={locale}>
      {!result ? (
        <p className="text-sm text-muted-foreground">{t("error")}</p>
      ) : !result.offers ? (
        <p className="text-sm text-muted-foreground">{t("none", { country: name })}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {OFFER_GROUPS.map((group) => {
            const providers = result.offers?.[group];
            if (!providers) return null;
            return (
              <div key={group} className="flex flex-col gap-1.5">
                <h3 className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{t("group", { group })}</h3>
                <ul className="flex flex-wrap gap-2">
                  {providers.map((p) => (
                    <li key={p.id}>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={p.name}
                        aria-label={t("provider", { provider: p.name, group })}
                        className="block size-12 overflow-hidden rounded-xl shadow-sm ring-1 ring-border transition-transform hover:-rotate-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <Image src={tmdbImageUrl(p.logo, "w92")} alt="" width={48} height={48} unoptimized className="size-full object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t.rich("attribution", {
          link: (chunks) => (
            <a href={JUSTWATCH_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">
              {chunks}
            </a>
          ),
        })}
      </p>
    </Frame>
  );
}

/** The block while TMDB answers. */
export async function WhereToWatchSkeleton() {
  const t = await getTranslations("WhereToWatch");
  return (
    <PaperCard className="flex flex-col gap-4 pt-6">
      <h2 className="font-display text-lg font-bold">{t("title")}</h2>
      <div aria-hidden="true" className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-12 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </PaperCard>
  );
}
