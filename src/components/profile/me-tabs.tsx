import { useTranslations } from "next-intl";
import { DividerTabs } from "@/components/divider-tabs";

/**
 * Me's tabs, under the cover (ADR 0053): Album (your page as visitors see it, `/me`), Stats (`/stats`) and Cards (every
 * card you made, `/me/cards`, ADR 0076), each its own server render. The nav island keeps Me lit on all three.
 */
export function MeTabs({ current }: { current: "album" | "stats" | "cards" }) {
  const t = useTranslations("Profile");
  return (
    <DividerTabs
      label={t("tabsLabel")}
      tabs={[
        { value: "album", href: "/me", name: t("tabAlbum") },
        { value: "stats", href: "/stats", name: t("tabStats") },
        { value: "cards", href: "/me/cards", name: t("tabCards") },
      ]}
      current={current}
      // Close to the cover above, and the tab's page starts right under it.
      className="-mt-2 -mb-4"
    />
  );
}

/**
 * Someone's tabs, under their cover (ADR 0077): Album (`/u/<username>`) and Stats (`/u/<username>/stats`). They swap
 * the history entry, so back leaves the profile, wherever it was opened from.
 */
export function ProfileTabs({ username, current }: { username: string; current: "album" | "stats" }) {
  const t = useTranslations("Profile");
  return (
    <DividerTabs
      label={t("profileTabsLabel", { username })}
      tabs={[
        { value: "album", href: `/u/${username}`, name: t("tabAlbum") },
        { value: "stats", href: `/u/${username}/stats`, name: t("tabStats") },
      ]}
      current={current}
      replace
      className="-mt-2 -mb-4"
    />
  );
}
