"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { saveAccount } from "../settings/save-account";

/**
 * The country "Where to watch" is shown for. Saved to the profile (the same setting as Settings → Country), then
 * the page reloads its data for the new country.
 */
export function CountryPicker({ country, options }: { country: string | null; options: [string, string][] }) {
  const t = useTranslations("WhereToWatch");
  const id = useId();
  const router = useRouter();
  const [value, setValue] = useState(country ?? "");
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [failed, setFailed] = useState(false);

  async function change(next: string) {
    const before = value;
    setValue(next);
    setFailed(false);
    setSaving(true);
    const result = await saveAccount({ country: next });
    setSaving(false);
    if (!result.ok) {
      setValue(before);
      setFailed(true);
      return;
    }
    startRefresh(() => router.refresh());
  }

  const busy = saving || refreshing;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {t("country")}
      </label>
      <select
        id={id}
        value={value}
        disabled={busy}
        aria-busy={busy}
        onChange={(e) => void change(e.target.value)}
        className={cn(
          "h-11 max-w-40 min-w-0 rounded-lg border border-input bg-background px-2 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60",
          !value && "text-muted-foreground",
        )}
      >
        {!value && (
          <option value="" disabled>
            {t("chooseCountry")}
          </option>
        )}
        {options.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <p aria-live="polite" className={cn("text-sm text-destructive", !failed && "sr-only")}>
        {failed ? t("saveError") : ""}
      </p>
    </div>
  );
}
