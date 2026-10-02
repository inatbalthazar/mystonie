import { BookmarkIcon, LockIcon } from "lucide-react";
import Image from "next/image";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import { AtlasAlbum } from "@/components/atlas/atlas-album";
import { StickerAlbum } from "@/components/badges/sticker-album";
import { Patches } from "@/components/challenges/patches";
import { ClubCrest } from "@/components/clubs/crest";
import { AreaSummary } from "@/components/collection/collection-header";
import { SwipeArea } from "@/components/motion/swipe-area";
import { ReportButton } from "@/components/report-button";
import { SharedCardImage } from "@/components/shared-card";
import { BlockButton } from "@/components/social/block-button";
import { ShareCollection } from "@/components/stats/share-collection";
import type { AlbumLayout, AlbumSection } from "@/core/album";
import { localizedPath } from "@/core/auth";
import { isVisited, type Place } from "@/core/atlas";
import { albumBadges, BADGES, evaluateBadges } from "@/core/badges";
import type { ClubSlug } from "@/core/clubs";
import { shelfItems } from "@/core/shelf";
import { weekStartFor } from "@/core/stats/period";
import { collectionAreaTotals, collectionCards } from "@/core/stats/report";
import { userPlaces } from "@/data/atlas";
import { userBadges } from "@/data/badges";
import { sharedCards } from "@/data/cards";
import { userPatches } from "@/data/challenges";
import { userClubs } from "@/data/clubs";
import { currentlyWatching } from "@/data/profiles";
import { savedArticles } from "@/data/journal-feed";
import { followCounts } from "@/data/social";
import { statsRows } from "@/data/stats";
import type { UserClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import { AlbumCover, type AlbumProfile } from "./album-cover";
import { ArrangeAlbum } from "./arrange-album";
import { MeTabs } from "./me-tabs";
import { PreviewList } from "./preview-list";
import { Shelf } from "./shelf";
import { ShelfFavourites } from "./shelf-favourites";

const GALLERY_MAX = 30;
const WATCHING_MAX = 6;
const SHELF_MAX = 48;
const SAVED_MAX = 3;

export type { AlbumProfile } from "./album-cover";

/**
 * A collector's album (S1 profile & privacy): under the cover, the pinned all-time numbers, then its sections in the
 * order its owner arranged, minus the hidden ones (`layout`, ADR 0069): shared cards newest first, what they're
 * watching now, the Shelf with its favourites and their stickers (S3 badges & shelf), their Atlas when shown (stage 4,
 * ADR 0059), their challenge patches and clubs (S3 challenges & clubs), and the owner's saved articles. Long ones show
 * two rows and "Show all". Visitors see it at /u/<username>; the owner also at /me, the nav island's Me (ADR 0050), even
 * while it's private to everyone else (`privateToOthers`), as the Album tab next to Stats (`me`, ADR 0053). The
 * owner gets Share my collection and Settings, and on Me "Arrange" and "Pick favourites".
 */
export async function ProfileAlbum({
  db,
  profile,
  viewerId,
  locale,
  timeZone = "UTC",
  privateToOthers = false,
  me = false,
  layout,
}: {
  db: UserClient;
  profile: AlbumProfile;
  layout: AlbumLayout;
  viewerId: string | null;
  locale: Locale;
  /** The owner's own zone, for their Share my collection cards (visitors' pages don't read it). */
  timeZone?: string;
  privateToOthers?: boolean;
  /** Shown at /me: Me's tabs (Album · Stats) under the cover. */
  me?: boolean;
}) {
  const isOwner = viewerId === profile.id;
  const [rows, watching, cards, counts, awarded, patches, clubs, saved, places, atlasPublic, t, tb, tc, tl, tj] = await Promise.all([
    statsRows(db, profile.id),
    currentlyWatching(db, profile.id, WATCHING_MAX),
    sharedCards(db, profile.id, GALLERY_MAX),
    followCounts(db, profile.id).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    userBadges(db, profile.id).catch((error: unknown) => {
      console.error(error);
      return [];
    }),
    userPatches(db, profile.id).catch((error: unknown) => {
      console.error(error);
      return [];
    }),
    userClubs(db, profile.id).catch((error: unknown): ClubSlug[] => {
      console.error(error);
      return [];
    }),
    // The Journal articles you saved to read (ADR 0052): only on your own page.
    isOwner && viewerId
      ? savedArticles(db, viewerId, locale).catch((error: unknown) => {
          console.error(error);
          return [];
        })
      : [],
    // RLS returns a visitor the places only when the Atlas is shown; the owner always gets them.
    userPlaces(db, profile.id).catch((error: unknown): Place[] => {
      console.error(error);
      return [];
    }),
    isOwner ? ownAtlasPublic(db, profile.id) : true,
    getTranslations("Profile"),
    getTranslations("Badges"),
    getTranslations("Challenges"),
    getTranslations("Clubs"),
    getTranslations("Journal"),
  ]);
  // Pinned all-time numbers, watched, read and played apart (stage 4).
  const totals = collectionAreaTotals(rows.titles, rows.entries, rows.logs, rows.reads);
  // Only awarded stickers (the server's record), in album order.
  const stickers = albumBadges(evaluateBadges([], [], "UTC"), awarded, () => null).filter((b) => b.earnedAt !== null);
  const shelf = shelfItems(rows.titles, rows.entries, SHELF_MAX, layout.shelfPins);
  const host = siteUrl().host;
  const areaCards = isOwner
    ? // eslint-disable-next-line react-hooks/purity -- a server render, once per request
      collectionCards(rows.titles, rows.entries, rows.logs, { timeZone, weekStart: weekStartFor(locale), now: Date.now() }, rows.reads)
    : null;

  // Every section, by name; empty ones are null (the gallery always shows, as an invitation when empty).
  const sections: Record<AlbumSection, ReactNode> = {
    cards: (
      <section aria-labelledby="card-gallery" className="flex flex-col gap-4">
        <h2 id="card-gallery" className="font-display text-xl font-extrabold">
          {t("gallery")}
        </h2>
        {cards.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center font-hand text-2xl text-muted-foreground">
            {t("galleryEmpty")}
          </p>
        ) : (
          <PreviewList
            phone={4}
            wide={6}
            className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3"
            itemClassNames={cards.map((_, i) => (i % 3 === 1 ? "rotate-[1.2deg]" : i % 3 === 2 ? "rotate-[-0.8deg]" : "rotate-[-1.6deg]"))}
            items={cards.map((card) => (
              <Link
                key={card.id}
                href={`/c/${card.id}`}
                className="block rounded-lg shadow-[0_2px_4px_rgb(0_0_0/0.08),0_14px_28px_-16px_rgb(0_0_0/0.45)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <SharedCardImage
                  imageUrl={card.imageUrl}
                  alt={t("cardAlt", { name: card.data.reel ? t("reelCard", { number: card.data.reel.number }) : card.data.atlas?.regions ? t("atlasRegionsCard", { country: card.data.name }) : card.data.atlas ? t("atlasCard", { count: card.data.atlas.countries.length }) : card.data.milestone ? t("milestoneCard") : card.data.recap?.highlights ? t("yearCard") : card.data.recap ? t("recapCard") : card.data.name })}
                  templateId={card.templateId}
                  size={card.size}
                  data={card.data}
                  host={host}
                  lazy
                />
              </Link>
            ))}
          />
        )}
      </section>
    ),

    watching: watching.length > 0 && (
      <section aria-labelledby="watching-now" className="flex flex-col gap-3">
        <h2 id="watching-now" className="font-display text-xl font-extrabold">
          {t("watchingNow")}
        </h2>
        {/* One row on phones that scrolls sideways (the fourth poster peeks in), a grid of six from 640px. */}
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:p-0">
          {watching.map((title, i) => (
            <li key={title.id} className={`w-[28%] shrink-0 snap-start sm:w-auto ${i % 2 ? "rotate-[1.5deg]" : "rotate-[-1.5deg]"}`}>
              <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border">
                {title.posterUrl && <Image src={title.posterUrl} alt="" fill unoptimized sizes="120px" className="object-cover" />}
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-medium">{title.name}</p>
            </li>
          ))}
        </ul>
      </section>
    ),

    shelf: shelf.items.length > 0 && (
      <Shelf
        items={shelf.items}
        pinned={shelf.pinned}
        more={shelf.more}
        favourites={me && <ShelfFavourites titles={shelfItems(rows.titles, rows.entries, Infinity).items} pins={layout.shelfPins} />}
      />
    ),

    stickers: stickers.length > 0 && (
      <section aria-labelledby="stickers" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="stickers" className="font-display text-xl font-extrabold">
            {tb("stickers")}
          </h2>
          <p className="font-hand text-xl leading-none text-muted-foreground">{tb("stickersCount", { count: stickers.length, total: BADGES.length })}</p>
        </div>
        <StickerAlbum badges={stickers} compact />
      </section>
    ),

    atlas: atlasPublic && places.some(isVisited) && <AtlasAlbum places={places} owner={isOwner} />,

    patches: patches.length > 0 && (
      <section aria-labelledby="patches" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="patches" className="font-display text-xl font-extrabold">
            {tc("profileTitle")}
          </h2>
          <p className="font-hand text-xl leading-none text-muted-foreground">{tc("patchesCount", { count: patches.length })}</p>
        </div>
        <Patches patches={patches.map((p) => ({ slug: p.slug, month: p.month }))} compact />
      </section>
    ),

    clubs: (clubs.length > 0 || isOwner) && (
      <section aria-labelledby="clubs" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="clubs" className="font-display text-xl font-extrabold">
            {tl("profileTitle")}
          </h2>
          {isOwner && (
            <Link href="/clubs" className="flex min-h-11 items-center text-sm font-semibold text-brand">
              {tl("profileEmpty")}
            </Link>
          )}
        </div>
        {clubs.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {clubs.map((club, i) => (
              <li key={club}>
                <Link href={`/clubs/${club}`} className="flex min-h-11 items-center gap-2 rounded-full bg-card py-1 pr-4 pl-2 text-sm font-semibold shadow-sm ring-1 ring-border hover:bg-muted">
                  <ClubCrest club={club} size={26} className={i % 2 ? "rotate-[5deg]" : "rotate-[-5deg]"} />
                  {tl(`items.${club}.name`)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    ),

    saved: saved.length > 0 && (
      <section aria-labelledby="saved-articles" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="saved-articles" className="font-display text-xl font-extrabold">
            {tj("savedTitle")}
          </h2>
          {saved.length > SAVED_MAX && (
            <Link href={{ pathname: "/feed", query: { tab: "saved" } }} className="flex min-h-11 items-center text-sm font-semibold text-brand">
              {tj("seeAllSaved", { count: saved.length })}
            </Link>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {saved.slice(0, SAVED_MAX).map((a) => (
            <li key={a.slug}>
              <Link href={`/journal/${a.slug}`} className="flex min-h-11 items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-border hover:ring-brand/50">
                <BookmarkIcon className="size-5 shrink-0 fill-current text-brand" aria-hidden="true" />
                <span lang={a.locale === locale ? undefined : a.locale} className="min-w-0 flex-1 font-semibold">
                  {a.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{tj("readTime", { minutes: a.minutes })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ),
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <AlbumCover
        profile={profile}
        owner={isOwner}
        counts={counts}
        follow={isOwner ? undefined : { signedIn: !!viewerId, next: localizedPath(`/u/${profile.username}`, locale, routing.defaultLocale) }}
      />
      {me && <MeTabs current="album" />}
      <MeSwipe me={me}>
        {privateToOthers && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-brand-soft px-4 py-2 text-sm">
            <LockIcon className="size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>{t("ownerPrivate")}</span>
            <Link href="/settings" className="flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
              {t("openSettings")}
            </Link>
          </p>
        )}

        <AreaSummary totals={totals} />
        {/* "Share my collection" (stage 4): the pinned all-time numbers as a card per area, for the owner. */}
        {areaCards && (
          <div className="-mt-4">
            <ShareCollection cards={areaCards} username={profile.username} host={host} />
          </div>
        )}
        {me && (
          <div className="-mt-4 flex justify-end">
            <ArrangeAlbum order={layout.order} hidden={layout.hidden} atlasPublic={atlasPublic} />
          </div>
        )}

        {layout.order
          .filter((section) => !layout.hidden.includes(section))
          .map((section) => (
            <Fragment key={section}>{sections[section]}</Fragment>
          ))}

        {isOwner ? null : (
          <>
            {!viewerId && (
              <section className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-border px-5 py-6 text-center">
                <p className="font-display text-xl font-extrabold">{t("ctaTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("ctaBody")}</p>
                <Link
                  href={{ pathname: "/", query: { ref: "profile" } }}
                  className="flex h-12 items-center justify-center rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
                >
                  {t("ctaButton")}
                </Link>
              </section>
            )}
            <div className="flex flex-wrap justify-center gap-2 self-center">
              {viewerId && <BlockButton userId={profile.id} username={profile.username} blocked={false} />}
              <ReportButton targetKind="profile" targetId={profile.id} />
            </div>
          </>
        )}
      </MeSwipe>
    </main>
  );
}

/** Me's album swipes over to Stats, the tab next to it (ADR 0070); a visitor's album is just the page. */
function MeSwipe({ me, children }: { me: boolean; children: ReactNode }) {
  return me ? (
    <SwipeArea next="/stats" className="flex flex-col gap-8">
      {children}
    </SwipeArea>
  ) : (
    <>{children}</>
  );
}

/** Whether the owner shows their Atlas on the album (their /me page shows what visitors see). */
async function ownAtlasPublic(db: UserClient, userId: string): Promise<boolean> {
  const { data, error } = await db.from("profiles").select("atlas_public").eq("id", userId).single();
  if (error) console.error(`profile read failed: ${error.message}`);
  return data?.atlas_public ?? false;
}
