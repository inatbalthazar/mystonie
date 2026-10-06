"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isAndroidAppLaunch } from "@/core/android";
import { isIosDevice } from "@/core/install";

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
      // Chromium only offers this while the app isn't installed: an earlier "installed" (since uninstalled, or an
      // Android phone that once opened the app, which shares the browser's storage) is out of date.
      forgetInstalled();
      notify();
    };
    const onInstalled = () => {
      installEvent = null;
      markInstalled(); // also from the address bar's own install icon
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

/** Opened from the home screen (or as a desktop app, or as the Android app), not in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    isAndroidApp()
  );
}

const ANDROID_APP = "mystonie.androidApp";

/**
 * Inside the Android app from Google Play (ADR 0097), a Trusted Web Activity: its first page says so (`?source=twa`
 * or Chrome's `android-app://` referrer), and the app's session remembers it for the pages after.
 */
export function isAndroidApp(): boolean {
  const launch = isAndroidAppLaunch(window.location.search, document.referrer);
  try {
    if (launch) window.sessionStorage.setItem(ANDROID_APP, "1");
    return launch || window.sessionStorage.getItem(ANDROID_APP) === "1";
  } catch {
    return launch;
  }
}

/** `isAndroidApp` for rendering: false on the server and in the first render, so hydration matches. */
export function useAndroidApp(): boolean {
  return useSyncExternalStore(noSubscribe, isAndroidApp, () => false);
}

const noSubscribe = () => () => {};

/** iPhone or iPad (iPadOS reports itself as a Mac with touch), where installing is "Share → Add to Home Screen". */
export function isIos(): boolean {
  return isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
}

// Installed on this device (best effort; ADR 0088): seen as the installed app, accepted in the browser's dialog, or
// "It's on my home screen" after the steps. On iOS the home-screen app keeps its own storage, so Safari only learns it
// from that answer.
const INSTALLED = "mystonie.installed";

export function wasInstalled(): boolean {
  try {
    return window.localStorage.getItem(INSTALLED) === "1";
  } catch {
    return false;
  }
}

export function markInstalled() {
  try {
    window.localStorage.setItem(INSTALLED, "1");
  } catch {
    // Storage blocked: it counts until the page reloads.
  }
  notify();
}

function forgetInstalled() {
  try {
    window.localStorage.removeItem(INSTALLED);
  } catch {
    // Storage blocked: nothing was kept.
  }
}

const ASK = "mystonie:install";

/** Opens the install sheet (mounted once in the layout) with this browser's way, for anyone, on any device. */
export function askToInstall() {
  window.dispatchEvent(new Event(ASK));
}

export function onAskToInstall(listener: () => void) {
  window.addEventListener(ASK, listener);
  return () => window.removeEventListener(ASK, listener);
}

/** "Not now" on Home's install card or the install sheet: one answer quiets both (ADR 0085). */
export const INSTALL_DISMISSED = "mystonie.install.dismissed";
/** Installing comes first (the owner, 2026-10-03, ADR 0088): after "Not now" it's asked again a day later. */
export const INSTALL_QUIET_DAYS = 1;

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** "Not now" on a prompt, remembered on this device for 30 days unless said otherwise (best effort). */
export function dismissedRecently(key: string, days = 30): boolean {
  try {
    const at = Number(window.localStorage.getItem(key));
    return at > 0 && Date.now() - at < days * 86_400_000;
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
