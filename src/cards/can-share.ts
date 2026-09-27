"use client";

import { useSyncExternalStore } from "react";

/** Whether this browser can share image files (mobile Safari / Chrome); false on the server and most desktops. */
export function useCanShareFiles(): boolean {
  return useSyncExternalStore(noopSubscribe, canShareFiles, () => false);
}

function noopSubscribe() {
  return () => {};
}

let canShareFilesCache: boolean | undefined;
function canShareFiles(): boolean {
  if (canShareFilesCache === undefined) {
    const probe = new File([new Uint8Array(1)], "card.png", { type: "image/png" });
    canShareFilesCache = typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  }
  return canShareFilesCache;
}
