"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, GripVerticalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Sheet } from "@/components/sheet";
import { saveAccount } from "@/components/settings/save-account";
import { ALBUM_SECTIONS, moveSection, type AlbumSection } from "@/core/album";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** The gap between rows, in px (`gap-2`): a drag moves a row once the finger passed half a row and this gap. */
const GAP = 8;

/**
 * "Arrange album" on Me (ADR 0069): the album's sections as a short list in a bottom sheet. A row moves by dragging
 * its handle (only the handle, so the sheet still scrolls), with its arrows, or with the arrow keys on the handle;
 * the eye hides it (the Atlas's eye is "Show my Atlas on my profile"). Saved together, for visitors too.
 */
export function ArrangeAlbum({ order: savedOrder, hidden: savedHidden, atlasPublic }: { order: AlbumSection[]; hidden: AlbumSection[]; atlasPublic: boolean }) {
  const t = useTranslations("Album");
  const name = useSectionName();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState(savedOrder);
  const [hidden, setHidden] = useState(savedHidden);
  const [atlas, setAtlas] = useState(atlasPublic);
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");
  const [announce, setAnnounce] = useState("");
  const [drag, setDrag] = useState<{ section: AlbumSection; dy: number } | null>(null);
  // The live drag, read by pointer moves between renders: where the finger started (moved along as the row swaps).
  const live = useRef<{ section: AlbumSection; startY: number; step: number; order: AlbumSection[] } | null>(null);

  function show() {
    setOrder(savedOrder);
    setHidden(savedHidden);
    setAtlas(atlasPublic);
    setStatus("idle");
    setOpen(true);
  }

  function move(section: AlbumSection, to: number) {
    const next = moveSection(order, section, to);
    setOrder(next);
    setAnnounce(t("moved", { section: name(section), position: next.indexOf(section) + 1, total: next.length }));
  }

  const isShown = (s: AlbumSection) => (s === "atlas" ? atlas : !hidden.includes(s));
  function toggle(s: AlbumSection) {
    if (s === "atlas") setAtlas(!atlas);
    else setHidden(hidden.includes(s) ? hidden.filter((h) => h !== s) : [...hidden, s]);
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>, section: AlbumSection) {
    if (e.button !== 0) return;
    const row = e.currentTarget.closest("li");
    if (!row) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { section, startY: e.clientY, step: row.offsetHeight + GAP, order };
    setDrag({ section, dy: 0 });
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = live.current;
    if (!d) return;
    let dy = e.clientY - d.startY;
    const at = d.order.indexOf(d.section);
    // Past half a row, swap with the neighbour and carry on from the row's new place.
    if (dy > d.step / 2 && at < d.order.length - 1) {
      d.order = moveSection(d.order, d.section, at + 1);
      d.startY += d.step;
      dy -= d.step;
      setOrder(d.order);
    } else if (dy < -d.step / 2 && at > 0) {
      d.order = moveSection(d.order, d.section, at - 1);
      d.startY -= d.step;
      dy += d.step;
      setOrder(d.order);
    }
    setDrag({ section: d.section, dy });
  }

  function onPointerUp() {
    const d = live.current;
    if (!d) return;
    live.current = null;
    setDrag(null);
    setAnnounce(t("moved", { section: name(d.section), position: d.order.indexOf(d.section) + 1, total: d.order.length }));
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, section: AlbumSection) {
    const at = order.indexOf(section);
    if (e.key === "ArrowUp" && at > 0) move(section, at - 1);
    else if (e.key === "ArrowDown" && at < order.length - 1) move(section, at + 1);
    else return;
    e.preventDefault();
  }

  async function save() {
    setStatus("saving");
    const result = await saveAccount({ albumOrder: order, albumHidden: hidden, ...(atlas !== atlasPublic ? { atlasPublic: atlas } : {}) });
    if (!result.ok) return setStatus("failed");
    setOpen(false);
    router.refresh();
  }

  const icon = "size-5";
  const square = "flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="flex min-h-11 items-center gap-2 self-end rounded-full px-4 text-sm font-semibold text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground active:bg-muted"
      >
        <ArrowUpDownIcon className="size-4" aria-hidden="true" />
        {t("arrange")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("arrangeTitle")} closeLabel={t("close")}>
        <p className="-mt-2 text-sm text-muted-foreground">{t("arrangeHint")}</p>
        <ol className="flex flex-col gap-2">
          {order.map((section, i) => {
            const shown = isShown(section);
            const dragged = drag?.section === section;
            return (
              <li
                key={section}
                style={dragged ? { transform: `translateY(${drag.dy}px)` } : undefined}
                className={cn("flex items-center gap-1 rounded-2xl bg-card py-1 pr-1 ring-1 ring-border", dragged && "relative z-10 shadow-lg ring-brand")}
              >
                <button
                  type="button"
                  aria-label={t("drag", { section: name(section) })}
                  onPointerDown={(e) => onPointerDown(e, section)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={(e) => onKeyDown(e, section)}
                  className={cn(square, "cursor-grab touch-none active:cursor-grabbing")}
                >
                  <GripVerticalIcon className={icon} aria-hidden="true" />
                </button>
                <span className={cn("flex min-w-0 flex-1 flex-col leading-tight", !shown && "text-muted-foreground")}>
                  <span className={cn("font-semibold [overflow-wrap:anywhere]", !shown && "line-through decoration-1")}>{name(section)}</span>
                </span>
                <button type="button" aria-label={t("moveUp", { section: name(section) })} disabled={i === 0} onClick={() => move(section, i - 1)} className={square}>
                  <ArrowUpIcon className={icon} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t("moveDown", { section: name(section) })}
                  disabled={i === order.length - 1}
                  onClick={() => move(section, i + 1)}
                  className={square}
                >
                  <ArrowDownIcon className={icon} aria-hidden="true" />
                </button>
                <button type="button" aria-label={t(shown ? "hide" : "show", { section: name(section) })} onClick={() => toggle(section)} className={square}>
                  {shown ? <EyeIcon className={icon} aria-hidden="true" /> : <EyeOffIcon className={cn(icon, "text-brand")} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ol>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        <p className="text-sm text-muted-foreground">{t("hiddenNote")}</p>
        {/* Save stays under the thumb: the list runs past a phone's screen. */}
        <div className="sticky bottom-0 -mx-4 -mb-8 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setOrder([...ALBUM_SECTIONS]);
              setAnnounce(t("resetDone"));
            }}
            className="flex min-h-11 items-center text-sm font-semibold text-brand"
          >
            {t("reset")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="flex h-12 min-w-32 items-center justify-center rounded-full bg-brand px-6 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press"
          >
            {status === "saving" ? t("saving") : t("save")}
          </button>
          {status === "failed" && (
            <p role="alert" className="w-full text-sm font-medium text-destructive">
              {t("failed")}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}

/** A section's name, as its heading on the album says it. */
export function useSectionName(): (section: AlbumSection) => string {
  const profile = useTranslations("Profile");
  const badges = useTranslations("Badges");
  const atlas = useTranslations("Atlas");
  const challenges = useTranslations("Challenges");
  const clubs = useTranslations("Clubs");
  return (section) => {
    switch (section) {
      case "watching":
        return profile("watchingNow");
      case "shelf":
        return profile("shelf");
      case "stickers":
        return badges("stickers");
      case "atlas":
        return atlas("title");
      case "patches":
        return challenges("profileTitle");
      case "clubs":
        return clubs("profileTitle");
    }
  };
}
