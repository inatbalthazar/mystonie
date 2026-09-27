// Runtime formatting with locale-aware unit labels (i18n.md → Formatting): "2h 36m", "156 min".
// Built from Intl.NumberFormat units + Intl.ListFormat, which is what Intl.DurationFormat does,
// but with wider browser support.

const numberFormats = new Map<string, Intl.NumberFormat>();

function unit(value: number, locale: string, u: "hour" | "minute", display: "narrow" | "short"): string {
  const key = `${locale}|${u}|${display}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: display });
    numberFormats.set(key, format);
  }
  return format.format(value);
}

/** Hours and minutes: `2h 36m`, `45m`, `3h` (en); `2ชม. 36นาที` (th). Rounds to whole minutes. */
export function formatRuntime(minutes: number, locale: string): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(unit(hours, locale, "hour", "narrow"));
  if (rest || !hours) parts.push(unit(rest, locale, "minute", "narrow"));
  return new Intl.ListFormat(locale, { type: "unit", style: "narrow" }).format(parts);
}

/** Plain minutes, for the detail in `2h 36m (156 min)`. */
export function formatMinutes(minutes: number, locale: string): string {
  return unit(Math.max(0, Math.round(minutes)), locale, "minute", "short");
}
