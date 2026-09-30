// Product analytics events (PostHog). The names are the S0 spec's contract: dashboards depend on them.

export type AnalyticsEvents = {
  /** A card preview was made: a picked title (card maker) or a celebration (`card`: finish / progress). */
  card_created: { kind: string; tpl: string; card?: string };
  /** `offer`: the Survived card offered after finishing something scary (S2 content warnings). */
  template_switched: { tpl: string; via: "button" | "swipe" | "offer" };
  size_switched: { size: string };
  /** `channel`: the share sheet, or the copied `/c/[id]` link (desktop). `card`: finish / progress / sticker. */
  card_shared: { tpl: string; size: string; channel?: "share_sheet" | "link"; card?: string };
  /** `fallback`: Share wasn't possible, so the file was saved instead. */
  card_downloaded: { tpl: string; size: string; fallback: boolean; card?: string };
  /** A new account whose visit started on a shared card page (`/c/[id]`). */
  signup_from_card: { tpl?: string };
  waitlist_joined: { placement: string };
  /**
   * An import finished (S2 Letterboxd import, S3 import & export): where from, titles in the preview, how many
   * matched by themselves (target ≥ 95%), and how many were added.
   */
  import_done: { source: "letterboxd" | "goodreads" | "mal" | "tvtime" | "mystonie"; titles: number; auto: number; added: number };
  /**
   * Someone was followed (S3 social): from their profile, a people search, the activity list ("Follow back"), or
   * again from the Following list on /people after unfollowing.
   */
  followed: { via: "profile" | "search" | "activity" | "people" };
  /** A Stamp on someone's finish in the Following feed. */
  stamped: Record<string, never>;
  /** A badge (sticker) was announced after a save (S3 badges & shelf): its catalogue slug. */
  badge_earned: { badge: string };
  /** A monthly challenge was joined (S3 challenges & clubs): its slug. Completing one shows as `card_created` (`card`: challenge). */
  challenge_joined: { challenge: string };
  /** A fandom club was joined, from its page or the clubs list. */
  club_joined: { club: string; via: "club" | "list" };
  /** A scene warning was added on a title page (S3 warnings & quiz): its topic and whether it says where. */
  scene_warning_added: { topic: string; placed: boolean };
  /** A vote on someone's scene warning from the title page: saw it, not there, or taken back. */
  scene_warning_voted: { vote: "confirm" | "dispute" | "undo" };
  /** A warnings quiz answer: the kind of question, the choice, and whether the server counted it. */
  quiz_answered: { kind: "topic" | "warning"; choice: "yes" | "no" | "unsure"; counted: boolean };
};

export type AnalyticsEvent = keyof AnalyticsEvents;

/** Share-link attribution from the landing URL (`?ref=card&tpl=polaroid`), added to every event. */
export type Attribution = { ref?: string; tpl?: string };

const ATTRIBUTION_KEYS = ["ref", "tpl"] as const;
const VALUE_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function landingAttribution(search: string): Attribution {
  const params = new URLSearchParams(search);
  const out: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key);
    // Only short slugs: anything else is noise (or someone pasting data into the URL).
    if (value && VALUE_RE.test(value)) out[key] = value;
  }
  return out;
}

/** PostHog API host → its web app host (`https://eu.i.posthog.com` → `https://eu.posthog.com`). */
export function posthogUiHost(apiHost: string): string {
  return apiHost.replace("://eu.i.", "://eu.").replace("://us.i.", "://us.");
}

/** PostHog API host → its static assets host (`https://eu.i.posthog.com` → `https://eu-assets.i.posthog.com`). */
export function posthogAssetsHost(apiHost: string): string {
  return apiHost.replace(/:\/\/(eu|us)\.i\./, "://$1-assets.i.");
}
