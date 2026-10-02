import { Bone, CoverBones, SkeletonPage, TabBones, TicketBones } from "@/components/skeleton";

/** Someone's Stats skeleton (ADR 0077): the cover, the profile's tabs, the period tabs, the numbers and the heatmap. */
export default function ProfileStatsLoading() {
  return (
    <SkeletonPage>
      <CoverBones />
      <TabBones count={2} />
      <div className="flex gap-2">
        {[16, 18, 14, 20].map((w) => (
          <Bone key={w} className="h-11 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <TicketBones figures={3} />
      <Bone className="h-32 w-full rounded-2xl" />
    </SkeletonPage>
  );
}
