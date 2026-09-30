import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ShelfTitle } from "@/core/shelf";
import { cn } from "@/lib/utils";

/** Spine colours: dark cloth bindings that hold small white type at ≥ 4.5:1 in both themes. */
const SPINES = ["#7a2e2e", "#2d4a6b", "#35533a", "#6b4c1f", "#4b2f5e", "#1f5a5a", "#7a3d12", "#3a3a4a", "#6b1f3f", "#274060"];

/** A small stable number from an id, so a title keeps its spine colour and height between visits. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * The Shelf (S3 badges & shelf): everything a profile finished, newest first, standing on wooden shelves. Movies
 * and series face out as cases (their posters), books and manga show their spines, and games stand as game cases
 * (their key art under a platform band, S3 games). Rows are fixed-height slots
 * with a plank drawn under each by the background, so the planks line up however the items wrap.
 */
export async function Shelf({ items, more }: { items: ShelfTitle[]; more: number }) {
  const t = await getTranslations("Profile");
  return (
    <section aria-labelledby="shelf" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="shelf" className="font-display text-xl font-extrabold">
          {t("shelf")}
        </h2>
        <p className="font-hand text-xl leading-none text-muted-foreground">{t("shelfHint")}</p>
      </div>
      <ul
        className={cn(
          "flex flex-wrap items-end gap-x-1.5 gap-y-3 overflow-hidden rounded-xl bg-muted/50 px-3 pb-3 shadow-inner ring-1 ring-border",
          // A plank under every 112px row (+ the 12px gap it fills).
          "bg-[repeating-linear-gradient(to_bottom,transparent_0_112px,#b88a58_112px_115px,#a0744a_115px_124px)]",
          "dark:bg-[repeating-linear-gradient(to_bottom,transparent_0_112px,#7b5634_112px_115px,#5e4027_115px_124px)]",
        )}
      >
        {items.map((item, i) => {
          const h = hash(item.id);
          const label = <span className="sr-only">{t("shelfItem", { name: item.name, kind: item.kind })}</span>;
          if (item.kind === "book" || item.kind === "manga") {
            const manga = item.kind === "manga";
            return (
              <li key={item.id} title={item.name} className="flex h-[112px] items-end">
                {label}
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: SPINES[h % SPINES.length], height: `${84 + (h % 5) * 6}px` }}
                  className={cn(
                    "relative flex flex-col items-center overflow-hidden rounded-[3px] py-2 text-white shadow-[inset_-3px_0_0_rgb(0_0_0/0.25),inset_2px_0_0_rgb(255_255_255/0.12),0_2px_3px_rgb(0_0_0/0.3)]",
                    manga ? "w-[22px]" : "w-[28px]",
                    // Now and then a book leans on its neighbour.
                    i % 9 === 4 && "origin-bottom-left rotate-[5deg]",
                  )}
                >
                  <span className="absolute inset-x-0 top-1.5 h-px bg-white/40" />
                  <span className="absolute inset-x-0 bottom-1.5 h-px bg-white/40" />
                  <span className="min-h-0 flex-1 overflow-hidden text-[10px] leading-none font-bold tracking-wide text-ellipsis whitespace-nowrap [writing-mode:vertical-rl]">
                    {item.name}
                  </span>
                </span>
              </li>
            );
          }
          if (item.kind === "game") {
            return (
              <li key={item.id} title={item.name} className="flex h-[112px] items-end">
                {label}
                <span
                  aria-hidden="true"
                  className="relative flex h-[90px] w-[72px] flex-col overflow-hidden rounded-[4px] bg-[#23232b] shadow-[0_2px_4px_rgb(0_0_0/0.35)] ring-1 ring-black/10"
                >
                  {/* The platform band across the top of a game case. */}
                  <span className="flex h-[13px] shrink-0 items-center bg-[#2b2a33] px-1.5">
                    <span className="h-[3px] w-5 rounded-full bg-white/45" />
                  </span>
                  <span className="relative block min-h-0 flex-1 bg-muted">
                    {item.posterUrl ? (
                      <Image src={item.posterUrl} alt="" fill unoptimized sizes="72px" className="object-cover" />
                    ) : (
                      <span className="flex size-full items-center p-1 text-center text-[10px] leading-tight font-bold text-muted-foreground [overflow-wrap:anywhere]">
                        {item.name}
                      </span>
                    )}
                  </span>
                  <span className="absolute inset-y-0 left-1 w-2 bg-white/15" />
                </span>
              </li>
            );
          }
          return (
            <li key={item.id} title={item.name} className="flex h-[112px] items-end">
              {label}
              <span
                aria-hidden="true"
                className={cn(
                  "relative block h-[100px] w-[67px] overflow-hidden rounded-[3px] bg-muted shadow-[0_2px_4px_rgb(0_0_0/0.35)] ring-1 ring-black/10",
                  // Series stand as box sets: a thicker case edge.
                  item.kind === "series" ? "border-l-[5px] border-black/55" : "border-l-[3px] border-black/40",
                )}
              >
                {item.posterUrl ? (
                  <Image src={item.posterUrl} alt="" fill unoptimized sizes="67px" className="object-cover" />
                ) : (
                  <span className="flex size-full items-center p-1 text-center text-[10px] leading-tight font-bold text-muted-foreground [overflow-wrap:anywhere]">{item.name}</span>
                )}
                {/* The shine on a plastic case. */}
                <span className="absolute inset-y-0 left-1 w-2 bg-white/15" />
              </span>
            </li>
          );
        })}
      </ul>
      {more > 0 && <p className="text-center font-hand text-xl text-muted-foreground">{t("shelfMore", { count: more })}</p>}
    </section>
  );
}
