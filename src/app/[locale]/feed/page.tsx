import { FlagIcon, ShieldIcon, TrophyIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Avatar } from "@/components/social/avatar";
import { FeedList } from "@/components/social/feed-list";
import { FollowButton } from "@/components/social/follow-button";
import { localizedPath } from "@/core/auth";
import { nextFeedCursor } from "@/core/social";
import { followingFeed, myActivity } from "@/data/social";
import { userClient } from "@/data/supabase-server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const ACTIVITY = 8;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Social");
  return { title: `${t("feedTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * The Following feed (S3 social): what the people you follow finished, and your own finishes, newest first, each with
 * a Stamp. Above it, the latest Stamps on your finishes and new followers ("Follow back").
 */
export default async function FeedPage({ params }: PageProps<"/[locale]/feed">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/feed", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [items, activity, t, format] = await Promise.all([
    followingFeed(supabase, userId, null),
    myActivity(supabase, ACTIVITY).catch((error: unknown) => {
      console.error(error);
      return [];
    }),
    getTranslations("Social"),
    getFormatter(),
  ]);
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const friends = items.some((i) => !i.mine);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-1">
        <p className="font-hand text-2xl leading-none text-muted-foreground">{t("feedKicker")}</p>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("feedTitle")}</h1>
      </header>
      {/* The community pages, as tabs stuck along the album's edge. */}
      <nav aria-label={t("communityLabel")} className="-mt-4 flex flex-wrap gap-2">
        {[
          { href: "/board", icon: TrophyIcon, label: t("toBoard") },
          { href: "/challenges", icon: FlagIcon, label: t("toChallenges") },
          { href: "/clubs", icon: ShieldIcon, label: t("toClubs") },
          { href: "/people", icon: UsersIcon, label: t("findPeople") },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="flex min-h-11 items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-semibold text-brand shadow-sm ring-1 ring-border hover:bg-muted">
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      {activity.length > 0 && (
        <section aria-labelledby="activity" className="flex flex-col gap-2 rounded-2xl bg-brand-soft/60 p-4 dark:bg-brand/10">
          <h2 id="activity" className="font-display text-lg font-extrabold">
            {t("activityTitle")}
          </h2>
          <ul className="flex flex-col divide-y divide-dashed divide-brand/20">
            {activity.map((a) => {
              const name = a.user.displayName || a.user.username;
              return (
                <li key={`${a.kind}-${a.user.id}-${a.at}`} className="flex items-center gap-3 py-2">
                  <Link href={`/u/${a.user.username}`} className="shrink-0">
                    <Avatar name={name} url={a.user.avatarUrl} className="size-9" />
                  </Link>
                  <p className="min-w-0 flex-1 text-sm">
                    {t.rich(a.kind === "stamp" ? "activityStamp" : "activityFollow", {
                      name,
                      title: a.titleName ?? "",
                      b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
                    })}
                    <span className="block text-xs text-muted-foreground">{format.relativeTime(new Date(a.at), now)}</span>
                  </p>
                  {a.kind === "follow" && !a.iFollow && <FollowButton userId={a.user.id} following={false} via="activity" />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!friends && (
        <section className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-8 text-center">
          <p className="font-hand text-2xl text-muted-foreground">{t("feedEmpty")}</p>
          <Link
            href="/people"
            className="flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90"
          >
            <UsersIcon className="size-5" aria-hidden="true" />
            {t("findPeople")}
          </Link>
        </section>
      )}

      {items.length > 0 && <FeedList items={items} next={nextFeedCursor(items)} now={now} />}
    </main>
  );
}
