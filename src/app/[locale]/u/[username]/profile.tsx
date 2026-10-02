import { BanIcon, LockIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { BlockButton } from "@/components/social/block-button";
import { USERNAME_RE } from "@/core/account";
import { publicProfile, type PublicProfile } from "@/data/profiles";
import { userClient, type UserClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";

/**
 * The profile for this request (its Album and Stats tabs, and their metadata), or null when the name can't exist or
 * nobody has it.
 */
export const loadProfile = cache(async (raw: string) => {
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

/**
 * A profile the viewer can't see, on either tab: one they blocked (with Unblock), or a private one, which says so
 * (RLS hides the rest); its owner sees the album at /me and gets a pointer to Settings.
 */
export async function ClosedProfile({
  db,
  profile,
  viewerId,
}: {
  db: UserClient;
  profile: Extract<PublicProfile, { isPrivate: true }>;
  viewerId: string | null;
}) {
  const t = await getTranslations("Profile");

  if (profile.blockedId) {
    // The viewer blocked this person: say so, and let them undo it.
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 pt-16 pb-16 text-center">
        <span aria-hidden="true" className="flex size-16 rotate-[-6deg] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card">
          <BanIcon className="size-7 text-muted-foreground" />
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-balance">{t("blockedTitle", { username: profile.username })}</h1>
        <p className="text-muted-foreground">{t("blockedBody")}</p>
        <BlockButton userId={profile.blockedId} username={profile.username} blocked />
      </main>
    );
  }

  // Profiles are readable by their owner only, so finding the row means this is the owner's page.
  const { data: own } = viewerId ? await db.from("profiles").select("id").eq("username", profile.username).maybeSingle() : { data: null };
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
