import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BlockButton } from "@/components/social/block-button";
import { FollowButton } from "@/components/social/follow-button";
import { PeopleSearch } from "@/components/social/people-search";
import { PersonRow } from "@/components/social/person-row";
import { localizedPath } from "@/core/auth";
import { myBlocks, myFollowing } from "@/data/social";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Social");
  return { title: `${t("peopleTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/** Find people (S3 social): search by username or name, the people you follow (unfollow here) and the people you blocked. */
export default async function PeoplePage({ params }: PageProps<"/[locale]/people">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/people", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [following, blocked, t] = await Promise.all([myFollowing(supabase), myBlocks(supabase), getTranslations("Social")]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("peopleTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("peopleHint")}</p>
      </header>

      <PeopleSearch />

      <section aria-labelledby="following" className="flex flex-col gap-2">
        <h2 id="following" className="font-display text-xl font-extrabold">
          {t("followingTitle", { count: following.length })}
        </h2>
        {following.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border px-4 py-6 text-center font-hand text-xl text-muted-foreground">
            {t("followingEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {following.map((p) => (
              <li key={p.id}>
                <PersonRow person={p} action={<FollowButton userId={p.id} following via="people" />} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {blocked.length > 0 && (
        <section aria-labelledby="blocked" className="flex flex-col gap-2">
          <h2 id="blocked" className="font-display text-xl font-extrabold">
            {t("blockedTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("blockedHint")}</p>
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {blocked.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate font-semibold">{t("handle", { username: p.username })}</span>
                <BlockButton userId={p.id} username={p.username} blocked />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
