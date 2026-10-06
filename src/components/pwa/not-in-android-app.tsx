"use client";

import type { ReactNode } from "react";
import { useAndroidApp } from "./browser";

/** Shown everywhere but the Android app from Google Play (ADR 0097): tips and payments stay on the web. */
export function NotInAndroidApp({ children }: { children: ReactNode }) {
  return useAndroidApp() ? null : children;
}
