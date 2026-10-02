import { Bone, RowBones, SkeletonPage } from "@/components/skeleton";

/** A title page's skeleton (ADR 0070): the taped poster and name, then the check, warnings and where to watch. */
export default function TitleLoading() {
  return (
    <SkeletonPage className="gap-6 pt-8">
      <div className="flex items-center gap-4">
        <Bone className="aspect-[2/3] w-24 shrink-0 -rotate-2 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2.5">
          <Bone className="h-8 w-3/4 rounded-lg" />
          <Bone className="h-4 w-1/3" />
        </div>
      </div>
      <Bone className="h-24 w-full rounded-2xl" />
      <Bone className="h-16 w-full rounded-2xl" />
      <RowBones count={3} poster={false} />
    </SkeletonPage>
  );
}
