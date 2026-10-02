"use client";

import { XIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { sheetDismiss } from "@/core/motion";

/** How long a sheet takes to slide away (the exit transition of `dialog[data-sheet]` in globals.css). */
const CLOSE_MS = 420;

/**
 * A modal sheet on the native <dialog> (focus trap, Esc and inert background come from the browser):
 * slides up from the bottom on phones, centred on wider screens. Tapping the backdrop closes it, and on a phone so
 * does dragging its top (the grabber and the title) down, as in Threads (ADR 0070). It keeps showing what it showed
 * while it slides away, even when the caller has already cleared it.
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState({ title, children });
  if (open && (shown.title !== title || shown.children !== children)) setShown({ title, children });
  const [wasOpen, setWasOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  // Each opening starts afresh (a new key), even one that comes while the last is still sliding away.
  const [opening, setOpening] = useState(0);
  if (wasOpen !== open) {
    setWasOpen(open);
    setClosing(!open);
    if (open) setOpening(opening + 1);
  }
  const drag = useRef<{ y: number; at: number } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setClosing(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || (event.target as Element).closest("button")) return;
    drag.current = { y: event.clientY, at: event.timeStamp };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dialog = ref.current;
    if (!drag.current || !dialog) return;
    const dy = event.clientY - drag.current.y;
    dialog.style.transition = "none";
    // Down follows the finger; up gives a little, like a rubber band.
    dialog.style.translate = `0 ${dy > 0 ? dy : dy / 4}px`;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const dialog = ref.current;
    if (!drag.current || !dialog) return;
    const dy = event.clientY - drag.current.y;
    const dismiss = sheetDismiss(dy, event.timeStamp - drag.current.at);
    drag.current = null;
    dialog.style.transition = "";
    dialog.style.translate = "";
    // Closed in the same frame, so it slides on down from where the finger let go (or springs back up).
    if (dismiss) dialog.close();
  }

  return (
    <dialog
      ref={ref}
      data-sheet
      aria-label={shown.title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex flex-col gap-4 p-4 pt-0 pb-8 sm:p-6">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="-mx-4 flex touch-none flex-col px-4 pt-2 sm:mx-0 sm:touch-auto sm:p-0"
        >
          {/* The grabber: drag the sheet down to close it (phones). */}
          <span aria-hidden="true" className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">{shown.title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
            >
              <XIcon className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <Fragment key={opening}>{open ? children : closing && shown.children}</Fragment>
      </div>
    </dialog>
  );
}
