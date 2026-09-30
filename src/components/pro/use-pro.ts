"use client";

import { useEffect, useState } from "react";
import type { ProState } from "@/core/billing";

const OFF: ProState = { available: false, pro: false, renewsAt: null, cancelAtPeriodEnd: false };

// One request per page load, shared by every card editor on the page. Buying Pro goes through Stripe's page and
// back, which is a fresh load.
let cached: Promise<ProState> | null = null;

function load(): Promise<ProState> {
  cached ??= fetch("/api/billing/status")
    .then((res) => (res.ok ? (res.json() as Promise<ProState>) : OFF))
    .catch(() => {
      cached = null; // offline: ask again next time
      return OFF;
    });
  return cached;
}

/** Whether Pro exists here and the viewer has it (S2 Pro, ADR 0034). Null while loading: treat as not Pro. */
export function usePro(): ProState | null {
  const [state, setState] = useState<ProState | null>(null);
  useEffect(() => {
    let live = true;
    load().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);
  return state;
}
