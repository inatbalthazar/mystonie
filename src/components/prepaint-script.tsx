"use client";

import { useSyncExternalStore } from "react";
import { SIGNED_IN_SCRIPT } from "@/core/auth";
import { THEME_SCRIPT } from "@/lib/prefs";

const noSubscribe = () => () => {};

/**
 * The pre-paint script, in the server HTML only: the saved theme (src/lib/prefs.ts) and the signed-in hint that shows
 * the nav island (src/core/auth.ts). After hydration it renders nothing, so client-side re-renders of the layout (a
 * language switch) never create a <script> React won't run anyway.
 */
export function PrepaintScript() {
  const inServerHtml = useSyncExternalStore(noSubscribe, () => false, () => true);
  return inServerHtml ? <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + SIGNED_IN_SCRIPT }} /> : null;
}
