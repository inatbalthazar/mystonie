// Stonie in the header comes alive (ADR 0086): now and then it blinks, and every so often it does something.

/** What Stonie can do. Each one is a CSS animation on the mark (`[data-act]` in globals.css). */
export const STONIE_ACTS = ["hop", "sway", "look", "wink", "blush", "spin", "tilt"] as const;
export type StonieAct = (typeof STONIE_ACTS)[number];

/** How long each act runs, in ms (the CSS animations' durations): the act is cleared after it. */
export const STONIE_ACT_MS: Record<StonieAct, number> = {
  hop: 1000,
  sway: 1400,
  look: 1800,
  wink: 700,
  blush: 1500,
  spin: 900,
  tilt: 1600,
};

// Little things often, big ones rarely: a spin every time would wear thin.
const WEIGHTS: Record<StonieAct, number> = { hop: 5, sway: 4, look: 5, wink: 3, blush: 3, spin: 1, tilt: 2 };

/** A random act, never the one just done. `random` is in [0, 1), like Math.random(). */
export function pickStonieAct(random: number, last: StonieAct | null = null): StonieAct {
  const acts = STONIE_ACTS.filter((a) => a !== last);
  const total = acts.reduce((sum, a) => sum + WEIGHTS[a], 0);
  let at = random * total;
  for (const act of acts) {
    at -= WEIGHTS[act];
    if (at < 0) return act;
  }
  return acts[acts.length - 1]!;
}

/** Between acts: 7 to 16 seconds, so it's a surprise and never busy. */
export function nextActDelay(random: number): number {
  return Math.round(7000 + random * 9000);
}

/** Between blinks: 2.5 to 6.5 seconds, as people do. One blink in five is a double. */
export function nextBlink(random: number, random2: number): { delay: number; double: boolean } {
  return { delay: Math.round(2500 + random * 4000), double: random2 < 0.2 };
}
