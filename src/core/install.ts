// Putting Mystonie on a phone's home screen (ADR 0028, ADR 0085): which way this browser does it.

/**
 * - `prompt`: the browser's own install dialog is ready (Chromium on Android).
 * - `ios`: Safari's (or another iOS browser's) Share → Add to Home Screen.
 * - `menu`: an Android browser that installs from its own menu (⋮ → Install app / Add to Home screen).
 * - `in_app`: inside Instagram, Facebook, LINE, TikTok…, which can't install: open the page in the browser first.
 * - `desktop`: a computer without the dialog ready (the address bar's install icon, Safari's Add to Dock). Only when
 *   asked for (`askedInstallWay`): nobody on a computer is asked unprompted.
 * - `none`: already installed, a computer, or a robot.
 */
export type InstallWay = "prompt" | "ios" | "menu" | "in_app" | "desktop" | "none";

// Apps that open links in their own browser, which has no "Add to Home Screen": Facebook and Messenger (FBAN, FBAV,
// FB_IAB), Instagram, LINE, TikTok (musical_ly, Bytedance), Snapchat, Pinterest, LinkedIn, X, and Android webviews.
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|\bLine\/|musical_ly|Bytedance|TikTok|Snapchat|Pinterest|LinkedInApp|Twitter|; wv\)/i;

export function isInAppBrowser(ua: string): boolean {
  return IN_APP.test(ua);
}

export function isIosDevice(ua: string, platform = "", maxTouchPoints = 0): boolean {
  // iPadOS reports itself as a Mac with touch.
  return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function installWay(device: {
  ua: string;
  platform?: string;
  maxTouchPoints?: number;
  /** Opened from the home screen already. */
  standalone: boolean;
  /** Chromium's `beforeinstallprompt` came. */
  promptReady: boolean;
  /** A phone or tablet (a coarse pointer). */
  touch: boolean;
  /** Automation (`navigator.webdriver`): tests and crawlers never get asked. */
  robot: boolean;
}): InstallWay {
  if (device.standalone || device.robot) return "none";
  if (device.promptReady) return "prompt";
  if (!device.touch) return "none";
  if (isInAppBrowser(device.ua)) return "in_app";
  if (isIosDevice(device.ua, device.platform, device.maxTouchPoints)) return "ios";
  if (/Android/i.test(device.ua)) return "menu";
  return "none";
}

/**
 * Someone asked to install (the getting-started checklist's step, ADR 0088): every browser gets its way, a computer and
 * automation included. `none` only when it's already the installed app.
 */
export function askedInstallWay(device: Omit<Parameters<typeof installWay>[0], "touch" | "robot">): InstallWay {
  if (device.standalone) return "none";
  if (device.promptReady) return "prompt";
  if (isInAppBrowser(device.ua)) return "in_app";
  if (isIosDevice(device.ua, device.platform, device.maxTouchPoints)) return "ios";
  if (/Android/i.test(device.ua)) return "menu";
  return "desktop";
}

// Android browsers with their own engine or name: everything else that says "Chrome/" is Chrome itself.
const NOT_CHROME = /SamsungBrowser|EdgA|OPR\/|Firefox|FxiOS|YaBrowser|MiuiBrowser|HeyTapBrowser|UCBrowser|Vivaldi|DuckDuckGo|Brave/i;

/**
 * Android, but not in Chrome (Firefox, Samsung Internet without its dialog ready, an app's browser): Chrome installs in
 * one tap, so the Install button opens the page there (ADR 0088).
 */
export function canHandToChrome(ua: string): boolean {
  if (!/Android/i.test(ua)) return false;
  return isInAppBrowser(ua) || !/Chrome\/\d/.test(ua) || NOT_CHROME.test(ua);
}

/**
 * The same page in Chrome on Android (an intent link). Without Chrome, it stays on `href` (the fallback).
 * `https://mystonie.com/c/1?x=1` → `intent://mystonie.com/c/1?x=1#Intent;scheme=https;package=com.android.chrome;…`.
 */
export function chromeIntentUrl(href: string): string {
  const url = new URL(href);
  const fallback = encodeURIComponent(url.href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/** Pages where a visitor is busy or just passing through: signing in, an email link, the card lab, offline. */
const QUIET = /^\/(auth|unsubscribe|card-lab|offline)(\/|$)/;

/** `/th/auth` → quiet. Paths may carry a locale prefix. */
export function quietForInstall(path: string, locales: readonly string[]): boolean {
  const [, first, ...rest] = path.split("/");
  const clean = first && locales.includes(first) ? `/${rest.join("/")}` : path;
  return QUIET.test(clean);
}
