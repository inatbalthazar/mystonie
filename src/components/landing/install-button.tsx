"use client";

import { DownloadIcon } from "lucide-react";
import { askToInstall } from "@/components/pwa/browser";

/** The landing page's "Install the app": the install sheet, or the browser's own dialog when it's ready (ADR 0088). */
export function InstallButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={askToInstall}
      className="mt-2 flex h-12 items-center justify-center gap-2 self-start rounded-full bg-brand px-6 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
    >
      <DownloadIcon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}
