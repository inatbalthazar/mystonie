import { Bone, FeedBones, HeadingBones, SkeletonPage, TabBones } from "@/components/skeleton";

/** The feed's skeleton (ADR 0070): the heading, the community pages, the tabs and a few finishes. */
export default function FeedLoading() {
  return (
    <SkeletonPage width="xl">
      <HeadingBones />
      <div className="-mt-5 flex gap-2 overflow-hidden">
        {[28, 32, 24, 36].map((w) => (
          <Bone key={w} className="h-11 shrink-0 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <div className="flex flex-col gap-6">
        <TabBones />
        <FeedBones />
      </div>
    </SkeletonPage>
  );
}
