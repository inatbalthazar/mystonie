import { useTranslations } from "next-intl";
import { ShelfTabsFromUrl } from "@/components/collection/collection-header";
import { Bone, RowBones, SkeletonPage, TicketBones } from "@/components/skeleton";

/**
 * The collection's skeleton (ADR 0070): the real title and shelves, which stay put from the Atlas (ADR 0081), then the
 * summary ticket, the controls and a few rows.
 */
export default function CollectionLoading() {
  const t = useTranslations("Collection");
  return (
    <SkeletonPage className="gap-2 pb-28">
      <h1 data-stay="collection-title" className="font-display text-4xl font-extrabold tracking-[-0.03em]">
        {t("title")}
      </h1>
      <ShelfTabsFromUrl />
      <div className="mt-2 flex flex-col gap-4">
        <TicketBones />
        <div className="grid grid-cols-3 gap-2">
          <Bone className="h-11 rounded-lg" />
          <Bone className="h-11 rounded-lg" />
          <Bone className="h-11 rounded-lg" />
        </div>
        <RowBones count={5} />
      </div>
    </SkeletonPage>
  );
}
