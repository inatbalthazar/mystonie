import { Bone, SkeletonPart } from "@/components/skeleton";

/** Me's Journal tab's skeleton (ADR 0092), under Me's cover and tabs: the Write button and a few rows. */
export default function MyJournalLoading() {
  return (
    <SkeletonPart>
      <Bone className="h-12 w-44 rounded-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2 py-2">
          <Bone className="h-4 w-20" />
          <Bone className="h-6 w-3/4" />
          <Bone className="h-4 w-full" />
        </div>
      ))}
    </SkeletonPart>
  );
}
