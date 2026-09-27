"use client";

import { useEffect } from "react";

// Browser-side PWA state (ADR 0028): is the app installed, can it be installed, can it get notifications.

/** Chromium's install prompt event (not in the DOM typings). */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const installPromptReady = () => installEvent !== null;

/** Shows the browser's install dialog; false when it was dismissed or isn't available. */
export async function promptInstall(): Promise<boolean> {
  const event = installEvent;
  if (!event) return false;
  installEvent = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}

/**
 * Catches the install prompt as soon as the browser offers it (on any page, so Home can use it after a client
 * navigation). Mounted once in the layout.
 */
export function PwaListener() {
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep it for our own "Install" button
      installEvent = event as InstallPromptEvent;
      notify();
    };
    const onInstalled = () => {
      installEvent = null;
      notify();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

/** Opened from the home screen (or as a desktop app), not in a browser tab. */
export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone or iPad (iPadOS reports itself as a Mac with touch), where installing is "Share → Add to Home Screen". */
export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** "Not now" on a prompt, remembered on this device for 30 days (best effort). */
export function dismissedRecently(key: string): boolean {
  try {
    const at = Number(window.localStorage.getItem(key));
    return at > 0 && Date.now() - at < 30 * 86_400_000;
  } catch {
    return false;
  }
}

export function rememberDismissed(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage blocked: the prompt comes back next visit.
  }
}
