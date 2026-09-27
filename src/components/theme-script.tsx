"use client";

import { useSyncExternalStore } from "react";
import { THEME_SCRIPT } from "@/lib/prefs";

const noSubscribe = () => () => {};

/**
 * The pre-paint theme script (src/lib/prefs.ts), in the server HTML only. After hydration it renders nothing,
 * so client-side re-renders of the layout (a language switch) never create a <script> React won't run anyway.
 */
export function ThemeScript() {
  const inServerHtml = useSyncExternalStore(noSubscribe, () => false, () => true);
  return inServerHtml ? <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /> : null;
}
