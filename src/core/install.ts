// Putting Mystonie on a phone's home screen (ADR 0028, ADR 0085): which way this browser does it.

/**
 * - `prompt`: the browser's own install dialog is ready (Chromium on Android).
 * - `ios`: Safari's (or another iOS browser's) Share → Add to Home Screen.
 * - `menu`: an Android browser that installs from its own menu (⋮ → Install app / Add to Home screen).
 * - `in_app`: inside Instagram, Facebook, LINE, TikTok…, which can't install: open the page in the browser first.
 * - `none`: already installed, a computer, or a robot.
 */
export type InstallWay = "prompt" | "ios" | "menu" | "in_app" | "none";

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

/** Pages where a visitor is busy or just passing through: signing in, an email link, the card lab, offline. */
const QUIET = /^\/(auth|unsubscribe|card-lab|offline)(\/|$)/;

/** `/th/auth` → quiet. Paths may carry a locale prefix. */
export function quietForInstall(path: string, locales: readonly string[]): boolean {
  const [, first, ...rest] = path.split("/");
  const clean = first && locales.includes(first) ? `/${rest.join("/")}` : path;
  return QUIET.test(clean);
}
