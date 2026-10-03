import { useTranslations } from "next-intl";
import { ShelfTabs } from "@/components/collection/collection-header";
import { Bone, SkeletonPage } from "@/components/skeleton";

/**
 * The Atlas's skeleton (ADR 0070): the real title and shelves, which stay put from the page before (ADR 0081), then
 * the map and the country list.
 */
export default function AtlasLoading() {
  const t = useTranslations("Collection");
  return (
    <SkeletonPage className="gap-2 pb-28">
      <h1 data-stay="collection-title" className="font-display text-4xl font-extrabold tracking-[-0.03em]">
        {t("title")}
      </h1>
      <ShelfTabs shelf="atlas" />
      <div className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Bone key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Bone className="aspect-[2/1] w-full rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {[20, 28, 24, 32, 22].map((w) => (
            <Bone key={w} className="h-11 rounded-full" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
