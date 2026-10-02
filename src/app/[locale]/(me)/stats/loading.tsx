import { Bone, SkeletonPart, TicketBones } from "@/components/skeleton";

/** Stats' skeleton (ADR 0070), under the cover and tabs of Me's layout (ADR 0081): the period tabs, the numbers and the heatmap. */
export default function StatsLoading() {
  return (
    <SkeletonPart>
      <div className="flex gap-2">
        {[16, 18, 14, 20].map((w) => (
          <Bone key={w} className="h-11 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <TicketBones figures={3} />
      <Bone className="h-32 w-full rounded-2xl" />
      <Bone className="h-40 w-full rounded-2xl" />
    </SkeletonPart>
  );
}
