"use client";

import { useEffect } from "react";
import type { ViewSubject } from "@/core/views";

/**
 * Counts a visit to a public page, shared card or article once it's shown in a browser (ADR 0098): link previews,
 * crawlers and prefetches never run this. The server counts each visitor once a day and skips the owner. Renders
 * nothing; a failure is ignored.
 */
export function CountView({ subject, id }: { subject: ViewSubject; id: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, id }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [subject, id]);
  return null;
}
