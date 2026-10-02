// The iOS-style back button (ADR 0061): "‹ Atlas" at the top left of every page under a tab. It goes back to the page
// you came from in the app, named after it; opened from a link or a fresh tab, it goes up to the page's parent instead.
// Paths come without the locale prefix.

/** Pages with a fixed short name on the button. */
export const BACK_PAGE_NAMES = [
  "landing",
  "home",
  "collection",
  "atlas",
  "feed",
  "me",
  "stats",
  "settings",
  "people",
  "board",
  "challenges",
  "clubs",
  "reel",
  "pro",
] as const;
export type BackPageName = (typeof BACK_PAGE_NAMES)[number];

/** What the button calls the page it goes to: a fixed name, a country, someone's @username, or the page's own title. */
export type BackPage =
  { kind: "named"; page: BackPageName } | { kind: "country"; country: string } | { kind: "profile"; username: string } | { kind: "page" };

const NAMED: Record<string, BackPageName> = {
  "/": "landing",
  "/home": "home",
  "/collection": "collection",
  "/collection/atlas": "atlas",
  "/feed": "feed",
  "/me": "me",
  "/stats": "stats",
  "/settings": "settings",
  "/people": "people",
  "/board": "board",
  "/challenges": "challenges",
  "/clubs": "clubs",
  "/reel": "reel",
  "/pro": "pro",
};

function clean(path: string): string {
  return path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
}

/** The name the back button gives a page. */
export function backPage(path: string): BackPage {
  const p = clean(path);
  const named = NAMED[p];
  if (named) return { kind: "named", page: named };
  const country = /^\/collection\/atlas\/([a-z]{2})$/i.exec(p);
  if (country) return { kind: "country", country: country[1].toUpperCase() };
  const profile = /^\/u\/([^/]+)(?:\/stats)?$/.exec(p);
  if (profile) return { kind: "profile", username: decodeURIComponent(profile[1]) };
  return { kind: "page" };
}

// No button: the four tabs and their own tabs (Atlas is the collection's, Stats is Me's), and pages that are a step of
// signing in or have nowhere to go back to.
const NO_BACK = new Set([
  "/",
  "/home",
  "/collection",
  "/collection/atlas",
  "/feed",
  "/me",
  "/stats",
  "/auth",
  "/auth/confirm",
  "/offline",
  "/unsubscribe",
  "/card-lab",
]);

/** Whether a page has a back button at all. */
export function hasBack(path: string): boolean {
  return !NO_BACK.has(clean(path));
}

/** Where a page goes up to when there is no page before it in the app. `signedIn`: only for signed-in people. */
export type BackParent = { href: `/${string}`; signedIn: boolean };

const PARENTS: [RegExp, BackParent][] = [
  [/^\/collection\/atlas\/[a-z]{2}$/i, { href: "/collection/atlas", signedIn: true }],
  [/^\/title\//, { href: "/collection", signedIn: true }],
  [/^\/(people|board|challenges|clubs|reel)$/, { href: "/feed", signedIn: true }],
  [/^\/clubs\/[^/]+$/, { href: "/clubs", signedIn: true }],
  // The articles are listed in the feed, which visitors see too (ADR 0062).
  [/^\/journal\/[^/]+$/, { href: "/feed", signedIn: false }],
  [/^\/review\/[^/]+$/, { href: "/stats", signedIn: true }],
  [/^\/settings$/, { href: "/me", signedIn: true }],
  [/^\/settings\/.+$/, { href: "/settings", signedIn: true }],
  [/^\/(recap\/[^/]+|quiz|feedback)$/, { href: "/home", signedIn: true }],
  [/^\/pro$/, { href: "/me", signedIn: true }],
];

/**
 * A page's parent, or null for pages that only go back (someone's profile, a shared card, the legal pages): someone who
 * opened one from a link sees the logo there.
 */
export function backParent(path: string): BackParent | null {
  const p = clean(path);
  if (!hasBack(p)) return null;
  return PARENTS.find(([pattern]) => pattern.test(p))?.[1] ?? null;
}

/** The pages visited in this tab, oldest first: each one's path and, once known, its title. */
export type BackEntry = { path: string; title?: string };
export const BACK_STACK_MAX = 30;

/** A page with its own tabs counts as one page: someone's profile and its Stats tab (ADR 0077). */
const pageOf = (path: string) => path.replace(/^(\/u\/[^/]+)\/stats$/, "$1");

/**
 * The stack after landing on `path`. A step back (the button, the browser's back or a swipe: `popped`) to the page
 * before pops; another tab of the same page takes its place (those tabs replace the history entry too); anything else
 * pushes. The same page again (a reload, a new query) changes nothing.
 */
export function stepBack(stack: readonly BackEntry[], path: string, popped: boolean): BackEntry[] {
  const p = clean(path);
  const top = stack.at(-1);
  if (top?.path === p) return [...stack];
  if (popped && stack.at(-2)?.path === p) return stack.slice(0, -1);
  if (top && pageOf(top.path) === pageOf(p)) return [...stack.slice(0, -1), { path: p }];
  return [...stack, { path: p }].slice(-BACK_STACK_MAX);
}

/** The page before `path` in the app, if `path` is the current one. */
export function previousEntry(stack: readonly BackEntry[], path: string): BackEntry | null {
  return stack.at(-1)?.path === clean(path) ? (stack.at(-2) ?? null) : null;
}

/** A page's title as the back button shows it: without " · Mystonie". */
export function backTitle(documentTitle: string): string | undefined {
  const title = documentTitle.replace(/\s*·\s*Mystonie\s*$/, "").trim();
  return title && title !== "Mystonie" ? title : undefined;
}

/** A stack read back from storage, or [] when it isn't one. */
export function parseBackStack(raw: unknown): BackEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is BackEntry =>
        !!e &&
        typeof e === "object" &&
        typeof e.path === "string" &&
        e.path.startsWith("/") &&
        (e.title === undefined || typeof e.title === "string"),
    )
    .map((e) => (e.title === undefined ? { path: e.path } : { path: e.path, title: e.title.slice(0, 120) }))
    .slice(-BACK_STACK_MAX);
}
