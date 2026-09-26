export type Messages = { [key: string]: string | Messages };

/** Deep-merges `override` onto `base`, so keys missing from a translation fall back to English. */
export function mergeMessages(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] =
      typeof value === "object" && typeof current === "object"
        ? mergeMessages(current, value)
        : value;
  }
  return result;
}
