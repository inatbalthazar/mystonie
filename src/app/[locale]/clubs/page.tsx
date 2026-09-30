import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClubJoin } from "@/components/clubs/club-join";
import { ClubCrest } from "@/components/clubs/crest";
import { localizedPath } from "@/core/auth";
import { clubFit, orderClubs, type ClubSlug } from "@/core/clubs";
import { clubCounts, userClubs } from "@/data/clubs";
import { statsRows } from "@/data/stats";
import { userClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Clubs");
  return { title: `${t("title")} · Mystonie`, description: t("kicker") };
}

const logged = <T,>(fallback: T) => (error: unknown) => {
  console.error(error);
  return fallback;
};

const TILTS = ["rotate-[-0.6deg]", "rotate-[0.5deg]", "rotate-[-0.3deg]", "rotate-[0.7deg]"];

/**
 * Fandom clubs (S3 challenges & clubs): every club as a crest with its member count. Signed in, your clubs come
 * first, then the ones your finishes fit best ("12 of your finishes fit"). Open to signed-out visitors too.
 */
export default async function ClubsPage({ params }: PageProps<"/[locale]/clubs">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/clubs", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub ?? null;
  const [counts, mine, rows, t] = await Promise.all([
    supabase ? clubCounts(supabase).catch(logged(new Map<string, number>())) : new Map<string, number>(),
    supabase && userId ? userClubs(supabase, userId).catch(logged([] as ClubSlug[])) : ([] as ClubSlug[]),
    supabase && userId ? statsRows(supabase, userId).catch(logged(null)) : null,
    getTranslations("Clubs"),
  ]);
  const members = new Set<string>(mine);
  const fit = rows ? clubFit(rows.titles, rows.entries) : new Map<ClubSlug, number>();
  const order = orderClubs(members, fit);
  const groups = [
    { key: "yours", title: t("yourClubs"), clubs: order.filter((c) => members.has(c)) },
    { key: "more", title: t("moreClubs"), clubs: order.filter((c) => !members.has(c)) },
  ].filter((g) => g.clubs.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-1">
        <p className="font-hand text-2xl leading-none text-muted-foreground">{t("kicker")}</p>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      </header>

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`clubs-${group.key}`} className="flex flex-col gap-4">
          <h2 id={`clubs-${group.key}`} className="font-display text-xl font-extrabold">
            {group.title}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {group.clubs.map((club, i) => (
              <li key={club} className={cn("relative flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-md ring-1 ring-border", TILTS[i % TILTS.length])}>
                <Link href={`/clubs/${club}`} className="flex min-w-0 items-start gap-3 rounded-xl hover:opacity-90">
                  <ClubCrest club={club} size={52} className="rotate-[-4deg]" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-display text-lg leading-tight font-extrabold">{t(`items.${club}.name`)}</span>
                    <span className="text-sm text-muted-foreground">{t(`items.${club}.tagline`)}</span>
                    {!members.has(club) && (fit.get(club) ?? 0) > 0 && <span className="font-hand text-lg leading-tight text-brand">{t("fit", { count: fit.get(club)! })}</span>}
                  </span>
                </Link>
                <div className="flex min-h-11 items-center justify-between gap-2 border-t border-dashed border-border pt-2">
                  <span className="text-xs font-semibold text-muted-foreground">{t("members", { count: counts.get(club) ?? 0 })}</span>
                  {userId && !members.has(club) && <ClubJoin club={club} member={false} signedIn next={self} via="list" />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {userId && (
        <Link href="/challenges" className="self-start text-sm font-semibold text-brand">
          {t("toChallenges")}
        </Link>
      )}
    </main>
  );
}
