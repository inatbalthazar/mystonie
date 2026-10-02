import { AlbumBones } from "@/components/skeleton";

/** A profile's skeleton (ADR 0070): the album's cover, its Album · Stats tabs (ADR 0077), the numbers and the shelf. */
export default function ProfileLoading() {
  return <AlbumBones tabs={2} />;
}
