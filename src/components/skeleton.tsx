import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Skeletons (ADR 0070, ADR 0075): a page's shape in faint, still paper, shown by its `loading.tsx` while the server
 * reads its data. Each one follows its page's layout, so nothing jumps when the page arrives. It fades in only after
 * 300ms (globals.css), so a page that comes quickly never flashes one. The tabs' pages are prefetched whole and rarely
 * need one.
 */

/** One block of a skeleton. */
export function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" style={style} className={cn("skeleton block rounded-md", className)} />;
}

/** The page frame: the same width and padding as the page, "Loading…" for screen readers. */
export function SkeletonPage({ width = "2xl", className, children }: { width?: "md" | "xl" | "2xl"; className?: string; children: ReactNode }) {
  const t = useTranslations("Loading");
  return (
    <main
      data-skeleton
      aria-busy="true"
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-8 px-4 pt-10 pb-16",
        width === "md" ? "max-w-md" : width === "xl" ? "max-w-xl" : "max-w-2xl",
        className,
      )}
    >
      <span role="status" className="sr-only">
        {t("page")}
      </span>
      {children}
    </main>
  );
}

/** A tab's page under a layout that stays (Me's, ADR 0081): only the part that changes, "Loading…" for screen readers. */
export function SkeletonPart({ children }: { children: ReactNode }) {
  const t = useTranslations("Loading");
  return (
    <div data-skeleton aria-busy="true" className="flex flex-col gap-8">
      <span role="status" className="sr-only">
        {t("page")}
      </span>
      {children}
    </div>
  );
}

/** A page heading: the handwritten line above it and the title. */
export function HeadingBones({ kicker = true }: { kicker?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      {kicker && <Bone className="h-5 w-32" />}
      <Bone className="h-9 w-56 rounded-lg" />
    </div>
  );
}

/** A row of divider tabs. */
export function TabBones({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2 border-b-2 border-border">
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className={cn("h-10 rounded-b-none rounded-t-xl", i === 0 ? "w-24" : "w-20 opacity-60")} />
      ))}
    </div>
  );
}

/** Rows of a list: a poster and two lines. */
export function RowBones({ count = 4, poster = true }: { count?: number; poster?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
          {poster ? <Bone className="aspect-[2/3] w-12 shrink-0 rounded-md" /> : <Bone className="size-10 shrink-0 rounded-full" />}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bone className={cn("h-4", i % 2 ? "w-2/3" : "w-1/2")} />
            <Bone className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A grid of posters (or cards), tilted like the album's. */
export function PosterBones({ count = 6, columns = 3, card = false }: { count?: number; columns?: 2 | 3; card?: boolean }) {
  return (
    <div className={cn("grid gap-x-3 gap-y-5", columns === 2 ? "grid-cols-2 gap-x-4" : "grid-cols-3")}>
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className={cn("w-full rounded-lg", card ? "aspect-[4/5]" : "aspect-[2/3]", i % 2 ? "rotate-[1deg]" : "rotate-[-1deg]")} />
      ))}
    </div>
  );
}

/** The summary ticket of numbers (the collection, the album, Stats). */
export function TicketBones({ figures = 3 }: { figures?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card px-4 pt-5 pb-4 ring-1 ring-border">
      <Bone className="h-5 w-28" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: figures }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bone className="h-3 w-14" />
            <Bone className="h-7 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Finishes in the feed: who, when, a poster and a title, on a tilted card. */
export function FeedBones({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn("flex flex-col gap-3 rounded-2xl bg-card p-4 pt-5 ring-1 ring-border", i % 2 ? "rotate-[0.6deg]" : "rotate-[-0.5deg]")}>
          <div className="flex items-center gap-3">
            <Bone className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-4 w-28" />
              <Bone className="h-3 w-20" />
            </div>
          </div>
          <div className="flex gap-4">
            <Bone className="aspect-[2/3] w-20 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Bone className="h-3 w-16" />
              <Bone className="h-5 w-3/4" />
              <Bone className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The album's cover: the taped photo, the name and handle. */
export function CoverBones() {
  return (
    <div className="flex items-center gap-4">
      <Bone className="size-[84px] shrink-0 rotate-[-3deg] rounded-md" />
      <div className="flex flex-1 flex-col gap-2">
        <Bone className="h-8 w-40 rounded-lg" />
        <Bone className="h-4 w-24" />
        <Bone className="h-5 w-36" />
      </div>
    </div>
  );
}

/** A section heading in the album or on Home. */
export function SectionBones({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Bone className="h-6 w-36" />
      {children}
    </div>
  );
}

/** An album (a profile): the cover, its tabs (a profile's two), the numbers and the shelf. */
export function AlbumBones({ tabs = 0 }: { tabs?: number }) {
  return (
    <SkeletonPage>
      <CoverBones />
      {tabs > 0 && <TabBones count={tabs} />}
      <AlbumPartBones />
    </SkeletonPage>
  );
}

/** The album under its cover and tabs: the numbers and the shelf (Me's Album tab, ADR 0081). */
export function AlbumPartBones() {
  return (
    <>
      <TicketBones />
      <SectionBones>
        <PosterBones count={6} />
      </SectionBones>
    </>
  );
}
