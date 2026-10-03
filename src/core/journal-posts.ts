// Articles by Mystonie's members in the Journal (stage 4, ADR 0092): what a writer sends to save or publish one,
// what it's about (titles from the catalogs, or places), its state on the way to Featured, and the Journal's
// filters and sort. The team's articles stay files (ADR 0051); both meet in the same Journal.
import { isExternalId, isTitleKind, TITLE_KINDS, type TitleKind } from "./catalog/types";
import { isCountryCode, type CountryCode } from "./countries";
import { isUuidV7 } from "./ids";
import { articleFeedTime } from "./journal-feed";
import { isJournalTag, JOURNAL_TAGS_MAX, parseWriterBody, plainText, type JournalTag } from "./journal";

export const POST_TITLE_MAX = 120;
export const POST_DESCRIPTION_MAX = 200;
export const POST_BODY_MAX = 20_000;
/** A published article says something: at least this many characters of text. */
export const POST_BODY_MIN = 100;
export const POST_SUBJECTS_MAX = 6;
/** Web addresses aren't links in a writer's article; more than this many reads as spam. */
export const POST_URLS_MAX = 3;

/** What an article is about: a title from the catalogs, or a country (ADR 0092). */
export type JournalSubject = { kind: TitleKind; externalId: string } | { kind: "place"; country: CountryCode };
export const SUBJECT_KINDS = [...TITLE_KINDS, "place"] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];
export const isSubjectKind = (v: unknown): v is SubjectKind => (SUBJECT_KINDS as readonly unknown[]).includes(v);

/** A subject as stored (`journal_posts.subjects`): `movie:603`, `book:zyTCAlFPjgYC`, `place:JP`. */
export const subjectKey = (s: JournalSubject) => (s.kind === "place" ? `place:${s.country}` : `${s.kind}:${s.externalId}`);

export function parseSubject(raw: unknown): JournalSubject | null {
  if (typeof raw !== "string") return null;
  const at = raw.indexOf(":");
  if (at < 0) return null;
  const kind = raw.slice(0, at);
  const id = raw.slice(at + 1);
  if (kind === "place") return isCountryCode(id) ? { kind: "place", country: id } : null;
  return isTitleKind(kind) && isExternalId(kind, id) ? { kind, externalId: id } : null;
}

/** The stored subjects, skipping any that no longer parse. */
export const parseSubjects = (raw: readonly string[]): JournalSubject[] => raw.flatMap((s) => parseSubject(s) ?? []);

/** What PUT /api/journal/posts saves. `publish`: out of drafts (or kept out); `feature`: sent to be Featured. */
export type PostWrite = {
  id: string;
  locale: string;
  title: string;
  description: string | null;
  body: string;
  tags: JournalTag[];
  subjects: JournalSubject[];
  spoilers: boolean;
  publish: boolean;
  feature: boolean;
};

export type PostProblem = "title" | "description" | "body" | "short" | "links" | "tags" | "subjects" | "locale";
export type PostParse = { ok: true; post: PostWrite } | { ok: false; problem: PostProblem } | { ok: false; problem: "invalid" };

const length = (s: string) => [...s].length;

/**
 * Checks a writer's article. A draft needs a title only; publishing also needs a category and at least
 * `POST_BODY_MIN` characters of text, with no more than `POST_URLS_MAX` web addresses. `locales` are the app's.
 */
export function parsePostWrite(body: unknown, locales: readonly string[]): PostParse {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, problem: "invalid" };
  const b = body as Record<string, unknown>;
  if (typeof b.id !== "string" || !isUuidV7(b.id)) return { ok: false, problem: "invalid" };
  if (typeof b.publish !== "boolean" || typeof b.feature !== "boolean" || typeof b.spoilers !== "boolean") return { ok: false, problem: "invalid" };
  if (typeof b.locale !== "string" || !locales.includes(b.locale)) return { ok: false, problem: "locale" };

  const title = typeof b.title === "string" ? b.title.replace(/\s+/g, " ").trim() : null;
  if (!title || length(title) > POST_TITLE_MAX) return { ok: false, problem: "title" };
  if (b.description !== undefined && b.description !== null && typeof b.description !== "string") return { ok: false, problem: "description" };
  const description = typeof b.description === "string" ? b.description.replace(/\s+/g, " ").trim() || null : null;
  if (description && length(description) > POST_DESCRIPTION_MAX) return { ok: false, problem: "description" };
  if (typeof b.body !== "string") return { ok: false, problem: "body" };
  const text = b.body.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
  if (length(text) > POST_BODY_MAX) return { ok: false, problem: "body" };

  if (!Array.isArray(b.tags) || !b.tags.every(isJournalTag)) return { ok: false, problem: "tags" };
  const tags = [...new Set(b.tags)];
  if (tags.length > JOURNAL_TAGS_MAX) return { ok: false, problem: "tags" };
  if (!Array.isArray(b.subjects)) return { ok: false, problem: "subjects" };
  const subjects: JournalSubject[] = [];
  for (const raw of b.subjects) {
    const subject = parseSubject(raw);
    if (!subject) return { ok: false, problem: "subjects" };
    if (!subjects.some((s) => subjectKey(s) === subjectKey(subject))) subjects.push(subject);
  }
  if (subjects.length > POST_SUBJECTS_MAX) return { ok: false, problem: "subjects" };

  if (b.publish) {
    if (tags.length === 0) return { ok: false, problem: "tags" };
    if (length(plainText(parseWriterBody(text)).replace(/\s+/g, " ").trim()) < POST_BODY_MIN) return { ok: false, problem: "short" };
    if ((text.match(/https?:\/\/|www\./gi) ?? []).length > POST_URLS_MAX) return { ok: false, problem: "links" };
  }
  return {
    ok: true,
    post: { id: b.id.toLowerCase(), locale: b.locale, title, description, body: text, tags, subjects, spoilers: b.spoilers, publish: b.publish, feature: b.publish && b.feature },
  };
}

export const EXCERPT_MAX = 160;

/**
 * The opening of an article's text for its row when the writer gave no description: up to `EXCERPT_MAX` characters,
 * cut at a space when there is one near the end, with an ellipsis. Null when there's no text.
 */
export function excerptOf(body: string): string | null {
  const text = plainText(parseWriterBody(body)).replace(/\s+/g, " ").trim();
  const chars = [...text];
  if (chars.length === 0) return null;
  if (chars.length <= EXCERPT_MAX) return text;
  const cut = chars.slice(0, EXCERPT_MAX - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > EXCERPT_MAX * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** `journal_posts.feature_request`: sent to be Featured (pending), then the team's answer. */
export const FEATURE_REQUESTS = ["pending", "approved", "declined"] as const;
export type FeatureRequest = (typeof FEATURE_REQUESTS)[number];
export const isFeatureRequest = (v: unknown): v is FeatureRequest => (FEATURE_REQUESTS as readonly unknown[]).includes(v);

/** Where a writer's article stands, as its writer sees it on Me's Journal. */
export type PostState = "draft" | "published" | "pending" | "featured" | "declined" | "hidden";

export function postState(p: { publishedAt: string | null; hiddenAt: string | null; featureRequest: string | null }): PostState {
  if (p.hiddenAt) return "hidden";
  if (!p.publishedAt) return "draft";
  if (p.featureRequest === "approved") return "featured";
  if (p.featureRequest === "pending") return "pending";
  if (p.featureRequest === "declined") return "declined";
  return "published";
}

/** What the team does to an article from the admin page (ADR 0092). */
export const REVIEW_ACTIONS = ["approve", "decline", "hide", "unhide"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];
export const REVIEW_NOTE_MAX = 300;

/** POST /api/admin/journal `{ id, action, note? }`. */
export function parseReview(body: unknown): { id: string; action: ReviewAction; note: string | null } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== "string" || !isUuidV7(b.id) || !(REVIEW_ACTIONS as readonly unknown[]).includes(b.action)) return null;
  if (b.note !== undefined && b.note !== null && typeof b.note !== "string") return null;
  const note = typeof b.note === "string" ? b.note.trim() || null : null;
  if (note && length(note) > REVIEW_NOTE_MAX) return null;
  return { id: b.id.toLowerCase(), action: b.action as ReviewAction, note };
}

/**
 * The team's addresses (`ADMIN_EMAILS`, comma separated): signed in with one of them, an account sees the admin page
 * that reviews articles (ADR 0092). No separate admin account.
 */
export function adminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+$/.test(e)),
  );
}

export const isAdminEmail = (raw: string | undefined, email: unknown) => typeof email === "string" && adminEmails(raw).has(email.trim().toLowerCase());

export const JOURNAL_SORTS = ["for_you", "new", "top"] as const;
export type JournalSort = (typeof JOURNAL_SORTS)[number];

/** The Journal's filters and order, from `?tag=&kind=&sort=` (ADR 0092). For you needs an account; visitors get Newest. */
export type JournalFilters = { tag: JournalTag | null; kind: SubjectKind | null; sort: JournalSort };

export function parseJournalFilters(query: Record<string, unknown>, signedIn: boolean): JournalFilters {
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const tag = one(query.tag);
  const kind = one(query.kind);
  const sort = one(query.sort);
  const sorts: readonly JournalSort[] = signedIn ? JOURNAL_SORTS : ["new", "top"];
  return {
    tag: isJournalTag(tag) ? tag : null,
    kind: isSubjectKind(kind) ? kind : null,
    sort: (sorts as readonly unknown[]).includes(sort) ? (sort as JournalSort) : sorts[0]!,
  };
}

/** The query that keeps `filters` (the default sort left out), for the Journal's links. */
export function filtersQuery(filters: JournalFilters, signedIn: boolean): Record<string, string> {
  return {
    ...(filters.tag ? { tag: filters.tag } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.sort !== (signedIn ? "for_you" : "new") ? { sort: filters.sort } : {}),
  };
}

type Filterable = { tags: readonly string[]; kinds: readonly string[] };

/** The articles with the tag and about the kind asked for. */
export function filterArticles<T extends Filterable>(articles: readonly T[], { tag, kind }: Pick<JournalFilters, "tag" | "kind">): T[] {
  return articles.filter((a) => (!tag || a.tags.includes(tag)) && (!kind || a.kinds.includes(kind)));
}

type Sortable = { slug: string; date: string; publishedAt: string | null; stamps: number };

/** Newest first; Most stamped puts the most Stamps first, then the newest. */
export function sortArticles<T extends Sortable>(articles: readonly T[], sort: Exclude<JournalSort, "for_you">): T[] {
  return [...articles].sort((a, b) => (sort === "top" ? b.stamps - a.stamps : 0) || articleFeedTime(b) - articleFeedTime(a) || a.slug.localeCompare(b.slug));
}

/** The kinds an article is about, once each, in the catalogs' order then places. */
export function subjectKinds(subjects: readonly { kind: string }[]): SubjectKind[] {
  return SUBJECT_KINDS.filter((kind) => subjects.some((s) => s.kind === kind));
}
