"use client";

import { XIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * A modal sheet on the native <dialog> (focus trap, Esc and inert background come from the browser):
 * slides up from the bottom on phones, centred on wider screens. Tapping the backdrop closes it.
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

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex flex-col gap-4 p-4 pb-8 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
