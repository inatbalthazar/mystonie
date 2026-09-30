"use client";

import { clearOutboxOps, useOutbox } from "./outbox";
import { forgetRecentTitles } from "./recent-titles";
import { clearSavedPages } from "./saved-pages";

// What this device keeps for the person signed in (S3 offline, ADR 0042): changes still waiting, the pages and posters
// saved for offline use, recently seen titles. The app's own files (the same for everyone) stay.

/** Everything the signed-in person left on this device (signing out, deleting the account). */
export async function clearOfflineData() {
  await clearOutboxOps();
  forgetRecentTitles();
  await clearSavedPages();
}

/** Changes on this device that haven't reached the server yet (the sign-out warning). */
export function useUnsyncedCount(): number {
  return useOutbox().items.filter((item) => item.state !== "held" || item.reason === "signed_out").length;
}
