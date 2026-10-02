import { HeadingBones, RowBones, SkeletonPage } from "@/components/skeleton";

/** The page's skeleton while it loads (ADR 0070): its heading and a few rows. */
export default function PeopleLoading() {
  return (
    <SkeletonPage width="xl" className="gap-6">
      <HeadingBones />
      <RowBones count={5} poster={false} />
    </SkeletonPage>
  );
}
