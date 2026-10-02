import { AlbumPartBones, SkeletonPart } from "@/components/skeleton";

/** Me's Album tab's skeleton (ADR 0070), under the cover and tabs of Me's layout (ADR 0081): the numbers and the shelf. */
export default function MeLoading() {
  return (
    <SkeletonPart>
      <AlbumPartBones />
    </SkeletonPart>
  );
}
