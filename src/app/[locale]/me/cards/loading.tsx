import { Bone, CoverBones, PosterBones, SkeletonPage, TabBones } from "@/components/skeleton";

/** Me's Cards tab's skeleton (ADR 0076): the album's cover, Me's tabs and a grid of cards. */
export default function MyCardsLoading() {
  return (
    <SkeletonPage>
      <CoverBones />
      <TabBones count={3} />
      <div className="flex flex-col gap-2">
        <Bone className="h-6 w-32" />
        <Bone className="h-4 w-3/4" />
      </div>
      <PosterBones count={4} columns={2} card />
    </SkeletonPage>
  );
}
