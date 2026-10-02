import { Bone, RowBones, SkeletonPage, TabBones, TicketBones } from "@/components/skeleton";

/** The collection's skeleton (ADR 0070): the title, the shelves, the summary ticket, the controls and a few rows. */
export default function CollectionLoading() {
  return (
    <SkeletonPage className="gap-4 pb-28">
      <Bone className="h-9 w-48 rounded-lg" />
      <TabBones count={4} />
      <TicketBones />
      <div className="grid grid-cols-3 gap-2">
        <Bone className="h-11 rounded-lg" />
        <Bone className="h-11 rounded-lg" />
        <Bone className="h-11 rounded-lg" />
      </div>
      <RowBones count={5} />
    </SkeletonPage>
  );
}
