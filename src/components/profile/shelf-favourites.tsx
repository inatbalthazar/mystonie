"use client";

import { SearchIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { saveAccount } from "@/components/settings/save-account";
import { SHELF_PINS_MAX, type ShelfTitle } from "@/core/shelf";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** A search box once the finishes run past three rows of the grid. */
const SEARCH_FROM = 12;

/**
 * "Pick favourites" under the Shelf on Me (ADR 0069): every finish as a poster in a bottom sheet, tap to pin up to
 * `SHELF_PINS_MAX`, numbered in the order they stand on the shelf. `titles`: every finish, newest first.
 */
export function ShelfFavourites({ titles, pins: savedPins }: { titles: ShelfTitle[]; pins: string[] }) {
  const t = useTranslations("Album");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState(savedPins);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");
  const full = pins.length >= SHELF_PINS_MAX;
  const q = query.trim().toLocaleLowerCase();
  const shown = q ? titles.filter((title) => title.name.toLocaleLowerCase().includes(q)) : titles;

  function show() {
    setPins(savedPins.filter((id) => titles.some((title) => title.id === id)));
    setQuery("");
    setStatus("idle");
    setOpen(true);
  }

  async function save() {
    setStatus("saving");
    const result = await saveAccount({ shelfPins: pins });
    if (!result.ok) return setStatus("failed");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={show} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-brand">
        <StarIcon className="size-4" aria-hidden="true" />
        {t("favourites")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("favouritesTitle")} closeLabel={t("close")}>
        <p className="-mt-2 text-sm text-muted-foreground">{t(full ? "favouritesFull" : "favouritesHint", { max: SHELF_PINS_MAX })}</p>
        {titles.length > SEARCH_FROM && (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("favouritesSearch")}
              aria-label={t("favouritesSearch")}
              autoComplete="off"
              enterKeyHint="search"
              className="h-12 w-full rounded-2xl border border-input bg-card pr-4 pl-12 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20"
            />
          </div>
        )}
        {shown.length === 0 ? (
          <p className="py-6 text-center font-hand text-xl text-muted-foreground">{t("favouritesNone")}</p>
        ) : (
          <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
            {shown.map((title) => {
              const at = pins.indexOf(title.id);
              const pinned = at >= 0;
              return (
                <li key={title.id}>
                  <button
                    type="button"
                    aria-pressed={pinned}
                    disabled={!pinned && full}
                    onClick={() => setPins(pinned ? pins.filter((id) => id !== title.id) : [...pins, title.id])}
                    className="group flex w-full flex-col gap-1 text-left disabled:opacity-40"
                  >
                    <span
                      className={cn(
                        "relative block aspect-[2/3] w-full overflow-hidden rounded-md bg-muted ring-1 ring-border transition-transform group-active:scale-95",
                        pinned && "ring-[3px] ring-brand",
                      )}
                    >
                      {title.posterUrl ? (
                        <Image src={title.posterUrl} alt="" fill unoptimized sizes="90px" className="object-cover" />
                      ) : (
                        <span className="flex size-full items-center p-1 text-center text-[10px] leading-tight font-bold text-muted-foreground [overflow-wrap:anywhere]">
                          {title.name}
                        </span>
                      )}
                      {pinned && (
                        <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-brand-foreground shadow tabular-nums">
                          {at + 1}
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-xs leading-tight font-medium">{title.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {/* Save stays under the thumb however long the grid is. */}
        <div className="sticky bottom-0 -mx-4 -mb-8 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
          {status === "failed" && (
            <p role="alert" className="mr-auto text-sm font-medium text-destructive">
              {t("failed")}
            </p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="flex h-12 min-w-32 items-center justify-center rounded-full bg-brand px-6 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press"
          >
            {status === "saving" ? t("saving") : t("save")}
          </button>
        </div>
      </Sheet>
    </>
  );
}
