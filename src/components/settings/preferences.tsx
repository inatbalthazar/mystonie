"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useLocale, useTranslations, type Locale } from "next-intl";
import { useId, useState, useSyncExternalStore } from "react";
import { THEMES, type Theme } from "@/core/account";
import { routing } from "@/i18n/routing";
import { applyTheme } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { nativeName, useChangeLocale } from "../locale-switcher";
import { saveAccount } from "./save-account";

const selectClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60";

const THEME_ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

const noSubscribe = () => () => {};
const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Settings → Preferences: language, time zone, country (for where to watch) and theme, each saved as soon as it changes. */
export function Preferences({
  timeZone: savedZone,
  timeZones,
  country: savedCountry,
  countries,
  theme: savedTheme,
}: {
  timeZone: string;
  timeZones: string[];
  country: string | null;
  countries: [string, string][];
  theme: Theme;
}) {
  const t = useTranslations("Settings");
  const id = useId();
  const locale = useLocale();
  const language = useChangeLocale();
  const [zone, setZone] = useState(savedZone);
  const [country, setCountry] = useState(savedCountry ?? "");
  const [theme, setTheme] = useState(savedTheme);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const device = useSyncExternalStore(noSubscribe, deviceZone, () => null);

  async function save(patch: Record<string, unknown>, undo: () => void) {
    setBusy(true);
    setFailed(false);
    const result = await saveAccount(patch);
    if (!result.ok) {
      undo();
      setFailed(true);
    }
    setBusy(false);
    return result.ok;
  }

  function changeZone(next: string) {
    const before = zone;
    setZone(next);
    void save({ timeZone: next }, () => setZone(before));
  }

  function changeCountry(next: string) {
    const before = country;
    setCountry(next);
    void save({ country: next }, () => setCountry(before));
  }

  async function changeTheme(next: Theme) {
    const before = theme;
    setTheme(next);
    // The server also refreshes the preferences cookie, which applies the theme on every later page load.
    if (await save({ theme: next }, () => setTheme(before))) applyTheme(next);
  }

  const zones = timeZones.includes(zone) ? timeZones : [zone, ...timeZones];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-language`} className="text-sm font-semibold">
          {t("language")}
        </label>
        <select
          id={`${id}-language`}
          value={locale}
          disabled={language.isPending}
          onChange={(e) => language.change(e.target.value as Locale)}
          className={selectClass}
        >
          {routing.locales.map((option) => (
            <option key={option} value={option} lang={option}>
              {nativeName(option)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-zone`} className="text-sm font-semibold">
          {t("timeZone")}
        </label>
        <select id={`${id}-zone`} value={zone} disabled={busy} onChange={(e) => changeZone(e.target.value)} className={selectClass}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        {device && device !== zone && zones.includes(device) && (
          <button
            type="button"
            onClick={() => changeZone(device)}
            disabled={busy}
            className="min-h-11 self-start text-left text-sm font-semibold text-brand underline-offset-4 hover:underline disabled:opacity-60"
          >
            {t("useDeviceTimeZone", { zone: device.replaceAll("_", " ") })}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-country`} className="text-sm font-semibold">
          {t("country")}
        </label>
        <select
          id={`${id}-country`}
          value={country}
          disabled={busy}
          aria-describedby={`${id}-country-hint`}
          onChange={(e) => changeCountry(e.target.value)}
          className={selectClass}
        >
          {!country && (
            <option value="" disabled>
              {t("countryNotSet")}
            </option>
          )}
          {countries.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <p id={`${id}-country-hint`} className="text-sm text-muted-foreground">
          {t("countryHint")}
        </p>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">{t("theme")}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {THEMES.map((option) => {
            const Icon = THEME_ICONS[option];
            return (
              <label
                key={option}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring",
                  theme === option && "bg-card text-foreground shadow-sm ring-1 ring-border",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-theme`}
                  value={option}
                  checked={theme === option}
                  disabled={busy}
                  onChange={() => changeTheme(option)}
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden="true" />
                {t("themeOption", { theme: option })}
              </label>
            );
          })}
        </div>
      </fieldset>

      <p aria-live="polite" className={cn("text-sm text-destructive", !(failed || language.failed) && "sr-only")}>
        {failed || language.failed ? t("saveError") : ""}
      </p>
    </div>
  );
}
