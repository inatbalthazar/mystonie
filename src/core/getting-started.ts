// The getting-started checklist on Home (stage 4): five steps, each ticked from what the user really did.

export const GETTING_STARTED_STEPS = ["add", "card", "topics", "social", "install"] as const;
export type GettingStartedStep = (typeof GETTING_STARTED_STEPS)[number];

export type GettingStartedFacts = {
  /** Anything in the collection. */
  entries: number;
  /** Cards made (a finish celebration saves one). */
  cards: number;
  avoidTopics: number;
  following: number;
  clubs: number;
  /** Opened as the installed app, on this device now or before. */
  installed: boolean;
};

export type GettingStarted = {
  steps: { step: GettingStartedStep; done: boolean }[];
  done: number;
  total: number;
  /** 0–100, rounded. */
  percent: number;
  complete: boolean;
};

export function gettingStarted(facts: GettingStartedFacts): GettingStarted {
  const done: Record<GettingStartedStep, boolean> = {
    add: facts.entries > 0,
    card: facts.cards > 0,
    topics: facts.avoidTopics > 0,
    social: facts.following > 0 || facts.clubs > 0,
    install: facts.installed,
  };
  const steps = GETTING_STARTED_STEPS.map((step) => ({ step, done: done[step] }));
  const count = steps.filter((s) => s.done).length;
  return { steps, done: count, total: steps.length, percent: Math.round((count / steps.length) * 100), complete: count === steps.length };
}
