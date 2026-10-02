import { Bone, SkeletonPage, TabBones } from "@/components/skeleton";

/** The Atlas's skeleton (ADR 0070): the title, the shelves, the map and the country list. */
export default function AtlasLoading() {
  return (
    <SkeletonPage className="gap-4 pb-28">
      <Bone className="h-9 w-48 rounded-lg" />
      <TabBones count={4} />
      <Bone className="aspect-[2/1] w-full rounded-2xl" />
      <div className="flex flex-wrap gap-2">
        {[20, 28, 24, 32, 22].map((w) => (
          <Bone key={w} className="h-11 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
    </SkeletonPage>
  );
}
