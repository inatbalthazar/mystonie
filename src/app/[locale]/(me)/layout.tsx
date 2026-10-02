import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { AlbumCover } from "@/components/profile/album-cover";
import { MeTabPage, MeTabs } from "@/components/profile/me-tabs";
import { CoverBones } from "@/components/skeleton";
import { followCounts } from "@/data/social";
import { userClient } from "@/data/supabase-server";

/**
 * Me (ADR 0081): the album's cover and Me's tabs (Album `/me`, Stats `/stats`, Cards `/me/cards`) around the open tab's
 * page. The layout stays while you switch tabs, so only the tab's page changes, sliding in from its side; the cover
 * isn't read again. Signed out, there's no cover: each tab's page sends you to sign in.
 */
export default async function MeLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <Suspense
        fallback={
          <div data-skeleton>
            <CoverBones />
          </div>
        }
      >
        <MeCover />
      </Suspense>
      <MeTabs />
      <MeTabPage>{children}</MeTabPage>
    </main>
  );
}

async function MeCover() {
  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!db || !userId) return null;
  const [{ data: profile, error }, counts] = await Promise.all([
    db.from("profiles").select("id, username, display_name, bio, avatar_url, created_at").eq("id", userId).single(),
    followCounts(db, userId).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
  ]);
  if (error) throw new Error(`profile read failed: ${error.message}`);
  return (
    <AlbumCover
      profile={{
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        joinedAt: profile.created_at,
      }}
      owner
      counts={counts}
    />
  );
}
