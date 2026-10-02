import { Bone, HeadingBones, PosterBones, RowBones, SectionBones, SkeletonPage } from "@/components/skeleton";

/** Home's skeleton (ADR 0070): the greeting, a note, Up next and the latest cards. */
export default function HomeLoading() {
  return (
    <SkeletonPage>
      <HeadingBones />
      <Bone className="h-28 w-full rounded-2xl" />
      <SectionBones>
        <RowBones count={2} />
      </SectionBones>
      <SectionBones>
        <PosterBones count={3} card />
      </SectionBones>
    </SkeletonPage>
  );
}
