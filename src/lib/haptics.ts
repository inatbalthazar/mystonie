/**
 * A light tap from the phone's vibration motor (ADR 0070): a Stamp pressed, an article saved, someone followed, a
 * title finished, a tab swiped. Only where the browser has one (Android; iOS Safari doesn't) and only right after a
 * tap, which browsers require anyway.
 */
export function haptic(pattern: number | number[] = 10) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
