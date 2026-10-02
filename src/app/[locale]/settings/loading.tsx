import { Bone, HeadingBones, SkeletonPage } from "@/components/skeleton";

/** Settings' skeleton (ADR 0070): the heading and its groups of fields. */
export default function SettingsLoading() {
  return (
    <SkeletonPage width="md" className="pt-12">
      <HeadingBones kicker={false} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Bone className="h-5 w-32" />
          <Bone className="h-12 w-full rounded-xl" />
          <Bone className="h-12 w-full rounded-xl" />
        </div>
      ))}
    </SkeletonPage>
  );
}
