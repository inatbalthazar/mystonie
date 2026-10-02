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
  followed: { via: "profile" | "search" | "activity" | "people" | "suggested" };
  /** A Stamp on someone's finish in the Following feed. */
  stamped: Record<string, never>;
  /** A badge (sticker) was announced after a save (S3 badges & shelf): its catalogue slug. */
  badge_earned: { badge: string };
  /** A monthly challenge was joined (S3 challenges & clubs): its slug. Completing one shows as `card_created` (`card`: challenge). */
  challenge_joined: { challenge: string };
  /** A fandom club was joined, from its page or the clubs list. */
  club_joined: { club: string; via: "club" | "list" };
  /** The getting-started checklist (stage 4, ADR 0056): its floating button opened, skipped, or its 100 % celebration closed. */
  getting_started: { action: "opened" | "welcomed" | "skipped" | "completed" };
  /** A picked title's details and warnings opened in the ➕ sheet before adding (stage 4, ADR 0058): its kind. */
  title_details_opened: { kind: string };
  /** A country put on the Atlas, changed or taken off (stage 4, ADR 0059): its new status, never the country. */
  place_saved: { status: "been" | "lived" | "want" | "removed" };
  /** A region of a country marked or unmarked on its page (stage 4, ADR 0060): never which one. */
  region_saved: { visited: boolean; via: "map" | "list" };
  /** A Reel of the Day play ended (stage 4 daily game): solved or not, and the guesses it took. */
  reel_finished: { solved: boolean; guesses: number };
  /** The spoiler-free result shared as text (the share sheet, or copied). The card shows as `card_shared` (`card`: reel). */
  reel_shared: { channel: "share_sheet" | "copy" };
  /** The "Buy me a coffee" tip link was opened (ADR 0049): from the footer or Settings. */
  support_clicked: { place: "footer" | "settings" };
  /**
   * The install sheet (ADR 0085): shown, answered with the browser's Install (or "I've added it already"), sent to
   * Chrome to install there (Android's other browsers), or closed.
   * `way`: the browser's dialog, Safari's Share steps, an Android menu, an app's browser (open in the real one first) or
   * a computer. `requested`: someone asked for it (the getting-started checklist, ADR 0088), not unprompted.
   */
  install_prompt: { action: "shown" | "installed" | "dismissed" | "to_chrome"; way: "prompt" | "ios" | "menu" | "in_app" | "desktop"; requested?: true };
  /** A beta report was sent from /feedback (ADR 0055): its kind only, never the message. */
  feedback_sent: { kind: "bug" | "idea" | "other" };
  /** "Check for family viewing" tapped on a title page: the family set of avoid-topics was saved (stage 4). */
  family_check_chosen: Record<string, never>;
  /** A scene warning was added on a title page (S3 warnings & quiz): its topic and whether it says where. */
  scene_warning_added: { topic: string; placed: boolean };
  /** A vote on someone's scene warning from the title page: saw it, not there, or taken back. */
  scene_warning_voted: { vote: "confirm" | "dispute" | "undo" };
  /** A warnings quiz answer: the kind of question, the choice, and whether the server counted it. */
  quiz_answered: { kind: "topic" | "warning"; choice: "yes" | "no" | "unsure"; counted: boolean };
  /** A Stamp on a Journal article (ADR 0052): from the Journal's rows, the article's page or the Following feed. */
  article_stamped: { place: ArticlePlace };
  /** A Journal article saved to read later. */
  article_saved: { place: ArticlePlace };
  /** A Journal article shared: the share sheet, or its link copied. */
  article_shared: { place: ArticlePlace; channel: "share_sheet" | "copy" };
};

/** Where a Journal article's Stamp, Save or Share was tapped. */
export type ArticlePlace = "article" | "feed";

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
