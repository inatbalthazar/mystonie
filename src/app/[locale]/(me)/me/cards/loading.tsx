import { Bone, PosterBones, SkeletonPart } from "@/components/skeleton";

/** Me's Cards tab's skeleton (ADR 0076), under the cover and tabs of Me's layout (ADR 0081): a grid of cards. */
export default function MyCardsLoading() {
  return (
    <SkeletonPart>
      <div className="flex flex-col gap-2">
        <Bone className="h-6 w-32" />
        <Bone className="h-4 w-3/4" />
      </div>
      <PosterBones count={4} columns={2} card />
    </SkeletonPart>
  );
}
