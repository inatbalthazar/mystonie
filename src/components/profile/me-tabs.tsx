"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { DividerTabs } from "@/components/divider-tabs";
import { PageTransition } from "@/components/motion/page-transition";
import { usePathname } from "@/i18n/navigation";
import { profileTabHref, type ProfileTab } from "@/lib/profile-tabs";

type MeTab = "album" | "stats" | "cards" | "journal";

/** Which of Me's tabs a path is on. */
function meTab(path: string): MeTab {
  return path.startsWith("/stats") ? "stats" : path.startsWith("/me/cards") ? "cards" : path.startsWith("/me/journal") ? "journal" : "album";
}

/**
 * Me's tabs, under the cover (ADR 0053): Album (your page as visitors see it, `/me`), Stats (`/stats`) and Cards (every
 * card you made, `/me/cards`, ADR 0076) and Journal (the articles you wrote, `/me/journal`, ADR 0092). They're in Me's layout with the cover (ADR 0081), so they stay put while a
 * tab's page comes in; the open one follows the address. The nav island keeps Me lit on all of them.
 */
export function MeTabs() {
  const t = useTranslations("Profile");
  const current = meTab(usePathname());
  return (
    <DividerTabs
      label={t("tabsLabel")}
      tabs={[
        { value: "album", href: "/me", name: t("tabAlbum") },
        { value: "stats", href: "/stats", name: t("tabStats") },
        { value: "cards", href: "/me/cards", name: t("tabCards") },
        { value: "journal", href: "/me/journal", name: t("tabJournal") },
      ]}
      current={current}
      // Four tabs (with Journal, ADR 0092) fit at 360px.
      compact
      // Close to the cover above, and the tab's page starts right under it.
      className="-mt-2 -mb-4"
    />
  );
}

/**
 * The open tab's page in Me's layout (ADR 0081): another tab slides in from its side as the old one leaves (ADR 0070),
 * under the cover and the tabs, which don't move. A new query (another period, more cards) stays the same tab.
 */
export function MeTabPage({ children }: { children: ReactNode }) {
  const current = meTab(usePathname());
  return (
    <PageTransition key={current}>
      <div className="flex flex-col gap-8">{children}</div>
    </PageTransition>
  );
}

/**
 * Someone's tabs, under their cover (ADR 0077): Album (`/u/<username>`), Stats (`/u/<username>/stats`) and Journal
 * (`/u/<username>/journal`, ADR 0092), those they have. They swap the history entry, so back leaves the profile,
 * wherever it was opened from. Nothing when there's only the album.
 */
export function ProfileTabs({ username, current, tabs }: { username: string; current: ProfileTab; tabs: readonly ProfileTab[] }) {
  const t = useTranslations("Profile");
  if (tabs.length < 2) return null;
  const names = { album: t("tabAlbum"), stats: t("tabStats"), journal: t("tabJournal") };
  return (
    <DividerTabs
      label={t("profileTabsLabel", { username })}
      tabs={tabs.map((tab) => ({ value: tab, href: profileTabHref(username, tab), name: names[tab] }))}
      current={current}
      replace
      className="-mt-2 -mb-4"
    />
  );
}
