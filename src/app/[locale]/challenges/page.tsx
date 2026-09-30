import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ChallengePanel, type ChallengeFriend } from "@/components/challenges/challenge-panel";
import { Patches } from "@/components/challenges/patches";
import { PaperCard } from "@/components/paper-card";
import { localizedPath } from "@/core/auth";
import { challengeUnit, daysLeft, isChallengeSlug, monthChallenges } from "@/core/challenges";
import { localDateKey } from "@/core/stats/period";
import { challengeCounts, friendJoins, joinCardData, syncChallenges, userPatches } from "@/data/challenges";
import { myFollowing } from "@/data/social";
import { statsRows } from "@/data/stats";
import { userClient } from "@/data/supabase-server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Challenges");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

const logged = <T,>(fallback: T) => (error: unknown) => {
  console.error(error);
  return fallback;
};

/**
 * This month's challenges (S3 challenges & clubs): the lineup with your progress, Join / Leave, the totals and the
 * people you follow who are in, then every patch you've earned. Rendering also records your progress, so the page
 * is never behind what you logged.
 */
export default async function ChallengesPage({ params }: PageProps<"/[locale]/challenges">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/challenges", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [{ data: profile }, rows, following, t, format] = await Promise.all([
    supabase.from("profiles").select("username, time_zone").eq("id", userId).single(),
    statsRows(supabase, userId),
    myFollowing(supabase).catch(logged([])),
    getTranslations("Challenges"),
    getFormatter(),
  ]);
  const timeZone = profile?.time_zone ?? "UTC";
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const sync = await syncChallenges(supabase, userId, rows, timeZone, now);
  const { month } = sync;
  const [counts, friends, patches] = await Promise.all([
    challengeCounts(supabase, month).catch(logged(new Map<string, { joined: number; completed: number }>())),
    friendJoins(supabase, following, month).catch(logged([])),
    userPatches(supabase, userId).catch(logged([])),
  ]);

  const lineup = monthChallenges(month);
  const left = daysLeft(month, now, timeZone);
  const monthName = format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" });
  const host = siteUrl().host;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-10 pb-16">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-hand text-2xl leading-none text-muted-foreground">{monthName}</p>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        </div>
        <span className="shrink-0 rotate-[4deg] rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand ring-1 ring-brand/30">{t("daysLeft", { count: left })}</span>
      </header>

      <div className="flex flex-col gap-5">
        {lineup.map((challenge, i) => {
          const slug = challenge.slug;
          if (!isChallengeSlug(slug)) return null;
          const join = sync.joins.find((j) => j.slug === slug);
          const progress = sync.progress.find((p) => p.slug === slug);
          const people: ChallengeFriend[] = friends
            .filter((f) => f.slug === slug)
            .map((f) => ({ id: f.person.id, username: f.person.username, name: f.person.displayName || f.person.username, avatarUrl: f.person.avatarUrl, value: f.progress, completed: f.completed }));
          return (
            <ChallengePanel
              key={slug}
              index={i}
              month={month}
              slug={slug}
              target={challenge.rule.target}
              unit={challengeUnit(challenge.rule)}
              value={join?.completedAt ? challenge.rule.target : (progress?.value ?? 0)}
              joined={!!join}
              completedOn={join?.completedAt ? localDateKey(Date.parse(join.completedAt), timeZone) : null}
              card={join ? joinCardData(join, rows, timeZone, sync.days) : null}
              counts={counts.get(slug) ?? { joined: 0, completed: 0 }}
              friends={people}
              username={profile?.username ?? null}
              host={host}
            />
          );
        })}
      </div>

      <PaperCard className="flex flex-col gap-4" stamp={patches.length > 0 ? t("patchesCount", { count: patches.length }) : undefined}>
        <h2 className="font-display text-xl font-extrabold">{t("patchesTitle")}</h2>
        {patches.length > 0 ? (
          <Patches patches={patches.map((p) => ({ slug: p.slug, month: p.month }))} />
        ) : (
          <p className="font-hand text-xl text-muted-foreground">{t("patchesEmpty")}</p>
        )}
      </PaperCard>

      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <Link href="/clubs" className="self-start text-sm font-semibold text-brand">
        {t("toClubs")}
      </Link>
    </main>
  );
}
