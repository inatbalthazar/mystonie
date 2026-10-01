import { useTranslations } from "next-intl";
import { DividerTabs } from "@/components/divider-tabs";

/**
 * Me's tabs, under the cover (ADR 0053): Album (your page as visitors see it, `/me`) and Stats (`/stats`), each its own
 * server render. The nav island keeps Me lit on both.
 */
export function MeTabs({ current }: { current: "album" | "stats" }) {
  const t = useTranslations("Profile");
  return (
    <DividerTabs
      label={t("tabsLabel")}
      tabs={[
        { value: "album", href: "/me", name: t("tabAlbum") },
        { value: "stats", href: "/stats", name: t("tabStats") },
      ]}
      current={current}
      // Close to the cover above, and the tab's page starts right under it.
      className="-mt-2 -mb-4"
    />
  );
}
