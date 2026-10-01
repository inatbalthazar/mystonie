import { SettingsIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { FollowButton } from "@/components/social/follow-button";
import { Link } from "@/i18n/navigation";

export type AlbumProfile = { id: string; username: string; displayName: string | null; bio: string | null; avatarUrl: string | null; joinedAt: string };
export type AlbumCounts = { followers: number; following: number; iFollow: boolean };

/**
 * The album's cover (S1 profile & privacy): a taped-in photo, the name and a handwritten "since", the bio (ADR 0057,
 * plain text: never linked), then followers and following. The owner gets Settings and Find people, a visitor Follow (`follow`). On Me it tops both tabs, Album and
 * Stats (ADR 0053), so switching tabs leaves it where it was.
 */
export function AlbumCover({
  profile,
  owner,
  counts,
  follow,
}: {
  profile: AlbumProfile;
  owner: boolean;
  counts: AlbumCounts | null;
  /** A visitor's Follow: whether they're signed in, and the page sign-in comes back to. */
  follow?: { signedIn: boolean; next: string };
}) {
  const t = useTranslations("Profile");
  const format = useFormatter();
  const name = profile.displayName ?? profile.username;

  return (
    <>
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
        {/* Signed in, the header has no links (the nav island does, ADR 0050): Settings opens from your own page. */}
        {owner && (
          <Link
            href="/settings"
            aria-label={t("settings")}
            className="flex size-11 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground"
          >
            <SettingsIcon className="size-5" aria-hidden="true" />
          </Link>
        )}
      </header>

      {profile.bio && <p className="-mt-3 text-[15px] leading-snug break-words whitespace-pre-line">{profile.bio}</p>}

      {(counts || !owner) && (
        <div className="-mt-4 flex flex-wrap items-center justify-between gap-3">
          {counts && (
            <p className="flex gap-4 text-sm text-muted-foreground">
              <span>{t.rich("followers", { count: counts.followers, b: (chunks) => <strong className="font-bold text-foreground tabular-nums">{chunks}</strong> })}</span>
              <span>{t.rich("followingCount", { count: counts.following, b: (chunks) => <strong className="font-bold text-foreground tabular-nums">{chunks}</strong> })}</span>
            </p>
          )}
          {owner ? (
            <Link href="/people" className="flex min-h-11 items-center text-sm font-semibold text-brand">
              {t("findPeople")}
            </Link>
          ) : (
            follow && <FollowButton userId={profile.id} following={counts?.iFollow ?? false} via="profile" signedIn={follow.signedIn} next={follow.next} />
          )}
        </div>
      )}
    </>
  );
}
