import { PREFS_MAX_AGE, type Theme } from "@/core/account";

/** Attributes of the preferences cookie (src/core/account.ts): whole site, first-party, readable by the theme script. */
export function prefsCookieOptions() {
  return {
    path: "/",
    maxAge: PREFS_MAX_AGE,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  };
}

/**
 * Runs before first paint (inline in <head>): applies a saved light/dark theme from the preferences cookie,
 * so a forced theme never flashes the system one. Without the cookie the page follows the system.
 */
export const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )mystonie_prefs=[a-z]{2}\\.(light|dark)(?:;|$)/);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`;

/** Applies a theme choice to the open page at once (later loads get it from the cookie via THEME_SCRIPT). */
export function applyTheme(theme: Theme): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}
