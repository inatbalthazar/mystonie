import { LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { CollectionSummary } from "@/components/collection/collection-header";
import { ReportButton } from "@/components/report-button";
import { SharedCardImage } from "@/components/shared-card";
import { USERNAME_RE } from "@/core/account";
import { summarizeCollection } from "@/core/stats/summary";
import { sharedCards } from "@/data/cards";
import { currentlyWatching, publicProfile } from "@/data/profiles";
import { statsRows } from "@/data/stats";
import { userClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/site";

const GALLERY_MAX = 30;
const WATCHING_MAX = 6;

/** The profile for this request (page + metadata), or null when the name can't exist or nobody has it. */
const load = cache(async (raw: string) => {
  const username = decodeURIComponent(raw).toLowerCase();
  if (!USERNAME_RE.test(username)) return null;
  const db = await userClient();
  if (!db) return null;
  try {
    const profile = await publicProfile(db, username);
    return profile && { db, profile };
  } catch (error) {
    console.error(error);
    return null;
  }
});

export async function generateMetadata({ params }: PageProps<"/[locale]/u/[username]">): Promise<Metadata> {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  const loaded = await load(username);
  if (!loaded) return { robots: { index: false } };
  const { profile } = loaded;
  const t = await getTranslations({ locale, namespace: "Profile" });
  if (profile.isPrivate) return { title: `${t("privateTitle")} · Mystonie`, robots: { index: false, follow: false } };
  const title = t("metaTitle", { name: profile.displayName ?? profile.username, username: profile.username });
  const description = t("metaDescription", { username: profile.username });
  return {
    title: `${title} · Mystonie`,
    description,
    // Public on purpose, but a person's page shouldn't show up in search results.
    robots: { index: false, follow: true },
    alternates: { canonical: `/u/${profile.username}` },
    openGraph: { type: "profile", title, description, url: `/u/${profile.username}`, siteName: "Mystonie" },
  };
}

/**
 * A public profile (S1 profile & privacy): the collector's album others can visit. Shared cards newest first,
 * headline numbers and what they're watching now. Private profiles only say so (RLS hides the rest).
 */
export default async function ProfilePage({ params }: PageProps<"/[locale]/u/[username]">) {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const loaded = await load(username);
  if (!loaded) notFound();
  const { db, profile } = loaded;
  const { data: auth } = await db.auth.getClaims();
  const viewerId = auth?.claims.sub ?? null;
  const t = await getTranslations("Profile");

  if (profile.isPrivate) {
    // Profiles are readable by their owner only, so finding the row means this is the owner's page.
    const { data: own } = viewerId
      ? await db.from("profiles").select("id").eq("username", profile.username).maybeSingle()
      : { data: null };
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 pt-16 pb-16 text-center">
        <span aria-hidden="true" className="flex size-16 rotate-[-6deg] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card">
          <LockIcon className="size-7 text-muted-foreground" />
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-balance">{t("privateTitle")}</h1>
        <p className="text-muted-foreground">{t("privateBody", { username: profile.username })}</p>
        {own && (
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-brand-soft px-4 py-3 text-sm">
            <p>{t("ownerPrivate")}</p>
            <Link href="/settings" className="flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
              {t("openSettings")}
            </Link>
          </div>
        )}
      </main>
    );
  }

  const [rows, watching, cards, format] = await Promise.all([
    statsRows(db, profile.id),
    currentlyWatching(db, profile.id, WATCHING_MAX),
    sharedCards(db, profile.id, GALLERY_MAX),
    getFormatter(),
  ]);
  const totals = summarizeCollection(rows.titles, rows.entries, rows.logs);
  const name = profile.displayName ?? profile.username;
  const isOwner = viewerId === profile.id;
  const host = siteUrl().host;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      {/* The album's cover: a taped-in photo, the name and a handwritten "since". */}
      <header className="flex items-center gap-4">
        <div className="relative shrink-0 rotate-[-3deg] rounded-md bg-card p-1.5 pb-4 shadow-md ring-1 ring-border">
          <span aria-hidden="true" className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[4deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/15 dark:bg-brand/30" />
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the Google profile photo, shown as is
            <img src={profile.avatarUrl} alt="" width={72} height={72} referrerPolicy="no-referrer" className="size-18 rounded-sm object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-18 items-center justify-center rounded-sm bg-brand-soft font-display text-3xl font-extrabold text-brand uppercase">
              {name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1
            className={`font-display leading-tight font-extrabold tracking-[-0.03em] break-words ${[...name].length > 14 ? "text-2xl" : "text-3xl"}`}
          >
            {name}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">{t("handle", { username: profile.username })}</p>
          <p className="font-hand text-xl leading-tight text-muted-foreground">
            {t("collectingSince", { date: format.dateTime(new Date(profile.joinedAt), { month: "long", year: "numeric" }) })}
          </p>
        </div>
      </header>

      <CollectionSummary totals={totals} year={null} />

      {watching.length > 0 && (
        <section aria-labelledby="watching-now" className="flex flex-col gap-3">
          <h2 id="watching-now" className="font-display text-xl font-extrabold">
            {t("watchingNow")}
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {watching.map((title, i) => (
              <li key={title.id} className={i % 2 ? "rotate-[1.5deg]" : "rotate-[-1.5deg]"}>
                <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border">
                  {title.posterUrl && <Image src={title.posterUrl} alt="" fill unoptimized sizes="120px" className="object-cover" />}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium">{title.name}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="card-gallery" className="flex flex-col gap-4">
        <h2 id="card-gallery" className="font-display text-xl font-extrabold">
          {t("gallery")}
        </h2>
        {cards.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center font-hand text-2xl text-muted-foreground">
            {t("galleryEmpty")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {cards.map((card, i) => (
              <li key={card.id} className={i % 3 === 1 ? "rotate-[1.2deg]" : i % 3 === 2 ? "rotate-[-0.8deg]" : "rotate-[-1.6deg]"}>
                <Link
                  href={`/c/${card.id}`}
                  className="block rounded-lg shadow-[0_2px_4px_rgb(0_0_0/0.08),0_14px_28px_-16px_rgb(0_0_0/0.45)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <SharedCardImage
                    imageUrl={card.imageUrl}
                    alt={t("cardAlt", { name: card.data.recap ? t("recapCard") : card.data.name })}
                    templateId={card.templateId}
                    size={card.size}
                    data={card.data}
                    host={host}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner ? null : (
        <>
          {!viewerId && (
            <section className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-border px-5 py-6 text-center">
              <p className="font-display text-xl font-extrabold">{t("ctaTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("ctaBody")}</p>
              <Link
                href={{ pathname: "/", query: { ref: "profile" } }}
                className="flex h-12 items-center justify-center rounded-2xl bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90"
              >
                {t("ctaButton")}
              </Link>
            </section>
          )}
          <ReportButton targetKind="profile" targetId={profile.id} className="self-center" />
        </>
      )}
    </main>
  );
}
