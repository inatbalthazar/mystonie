// Members' articles in the Journal (stage 4, ADR 0092): the writer's own drafts and articles, what readers may see
// (RLS: published, not taken down, the writer's page public and no block), and the team's review from the admin page
// (service role). Server only.
import { posterUrl } from "@/core/catalog/images";
import { sourceForKind, type TitleKind } from "@/core/catalog/types";
import { countryName } from "@/core/countries";
import { readingMinutes, parseWriterBody, type JournalTag } from "@/core/journal";
import { titleKey } from "@/core/journal-feed";
import {
  excerptOf,
  isFeatureRequest,
  parseSubjects,
  postState,
  subjectKey,
  type FeatureRequest,
  type JournalSubject,
  type PostState,
  type PostWrite,
  type ReviewAction,
} from "@/core/journal-posts";
import { reviewRequestEmail } from "@/core/email/report";
import { LEGAL } from "@/lib/legal";
import { siteUrl } from "@/lib/site";
import { emailConfig, sendEmail, sendToLocalInbox } from "./email";
import type { AdminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

const COLUMNS =
  "id, user_id, locale, title, description, excerpt, minutes, tags, subjects, spoilers, published_at, feature_request, featured_at, review_note, hidden_at, updated_at" as const;
const WITH_BODY = `${COLUMNS}, body` as const;

/** How many articles one list reads at most (the Journal's rows come from these). */
const LIST_MAX = 200;

type Row = {
  id: string;
  user_id: string;
  locale: string;
  title: string;
  description: string | null;
  excerpt: string | null;
  minutes: number;
  tags: string[];
  subjects: string[];
  spoilers: boolean;
  published_at: string | null;
  feature_request: string | null;
  featured_at: string | null;
  review_note: string | null;
  hidden_at: string | null;
  updated_at: string;
};

export type WriterPost = {
  id: string;
  userId: string;
  locale: string;
  title: string;
  description: string | null;
  /** The description, else the opening of the text. */
  summary: string | null;
  minutes: number;
  tags: JournalTag[];
  subjects: JournalSubject[];
  spoilers: boolean;
  publishedAt: string | null;
  featureRequest: FeatureRequest | null;
  featuredAt: string | null;
  reviewNote: string | null;
  hiddenAt: string | null;
  updatedAt: string;
  state: PostState;
};

function toPost(r: Row): WriterPost {
  const featureRequest = isFeatureRequest(r.feature_request) ? r.feature_request : null;
  return {
    id: r.id,
    userId: r.user_id,
    locale: r.locale,
    title: r.title,
    description: r.description,
    summary: r.description ?? r.excerpt,
    minutes: r.minutes,
    tags: r.tags as JournalTag[],
    subjects: parseSubjects(r.subjects),
    spoilers: r.spoilers,
    publishedAt: r.published_at,
    featureRequest,
    featuredAt: r.featured_at,
    reviewNote: r.review_note,
    hiddenAt: r.hidden_at,
    updatedAt: r.updated_at,
    state: postState({ publishedAt: r.published_at, hiddenAt: r.hidden_at, featureRequest }),
  };
}

/** The writer's own articles (drafts too), last edited first: Me's Journal. */
export async function myPosts(db: UserClient, userId: string): Promise<WriterPost[]> {
  const { data, error } = await db
    .from("journal_posts")
    .select(COLUMNS)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(LIST_MAX);
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  return data.map(toPost);
}

/** One article as the reader may see it (the writer: their drafts too), with its text; null when it can't be seen. */
export async function readPost(db: UserClient, id: string): Promise<(WriterPost & { body: string }) | null> {
  const { data, error } = await db.from("journal_posts").select(WITH_BODY).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  return data ? { ...toPost(data), body: data.body } : null;
}

/** Whether readers can see this article (published, not taken down, its writer's page public): Stamps and Saves need it. */
export async function isPublicPost(db: UserClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("journal_posts")
    .select("id")
    .eq("id", id)
    .not("published_at", "is", null)
    .is("hidden_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  return !!data;
}

export type SaveResult = { ok: true; post: WriterPost; sentForReview: boolean } | { ok: false; reason: "not_found" | "limit" };

/**
 * Saves the writer's article (new or theirs), as a draft or published, sent to be Featured or not. The database
 * stamps when it's published, and sends a Featured article whose text changed back to the team (ADR 0092).
 * `sentForReview`: it just joined the team's queue (newly pending), so the team gets an email.
 */
export async function savePost(db: UserClient, userId: string, write: PostWrite): Promise<SaveResult> {
  const { data: before, error: readError } = await db
    .from("journal_posts")
    .select("user_id, feature_request, published_at")
    .eq("id", write.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) throw new Error(`journal_posts read failed: ${readError.message}`);
  if (before && before.user_id !== userId) return { ok: false, reason: "not_found" };

  const blocks = parseWriterBody(write.body);
  // Keep the team's answer while it's still sent; the database turns it back to pending when the text changed.
  const feature: string | null = !write.publish || !write.feature ? null : (before?.feature_request ?? "pending");
  const fields = {
    locale: write.locale,
    title: write.title,
    description: write.description,
    body: write.body,
    excerpt: excerptOf(write.body),
    minutes: Math.min(200, readingMinutes(blocks)),
    tags: write.tags,
    subjects: write.subjects.map(subjectKey),
    spoilers: write.spoilers,
    // Any timestamp: the database keeps the first publication's own.
    published_at: write.publish ? (before?.published_at ?? new Date().toISOString()) : null,
    feature_request: feature,
  };
  const query = before
    ? db.from("journal_posts").update(fields).eq("id", write.id).eq("user_id", userId).select(COLUMNS).single()
    : db.from("journal_posts").insert({ id: write.id, ...fields }).select(COLUMNS).single();
  const { data, error } = await query;
  if (error) {
    // The trigger's daily and total caps.
    if (error.code === "23514" && error.message.includes("too many")) return { ok: false, reason: "limit" };
    if (error.code === "23505") return { ok: false, reason: "not_found" }; // someone else's id
    throw new Error(`journal_posts write failed: ${error.message}`);
  }
  const post = toPost(data);
  const wasPending = before?.feature_request === "pending" && !!before.published_at;
  return { ok: true, post, sentForReview: post.state === "pending" && !wasPending };
}

/** Deletes the writer's article (a soft delete). */
export async function deletePost(db: UserClient, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("journal_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(`journal_posts delete failed: ${error.message}`);
  return data.length > 0;
}

export type Byline = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

/** The writers' names and photos (public, unblocked people only). */
export async function bylines(db: UserClient | AdminClient, userIds: readonly string[]): Promise<Map<string, Byline>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await db.rpc("journal_bylines", { p_user_ids: ids });
  if (error) throw new Error(`journal_bylines failed: ${error.message}`);
  return new Map(data.map((r) => [r.id, { id: r.id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url }]));
}

/** A subject as the article page and the editor show it: a title's poster, name and year, or a country's name. */
export type SubjectCard =
  | { kind: TitleKind; externalId: string; name: string; year: number | null; posterUrl: string | null }
  | { kind: "place"; country: string; name: string };

/** The subjects with their names and posters from the catalog cache (a title not cached shows by its id's kind only). */
export async function subjectCards(db: UserClient, subjects: readonly JournalSubject[], locale: string): Promise<SubjectCard[]> {
  const titles = subjects.filter((s): s is Extract<JournalSubject, { externalId: string }> => s.kind !== "place");
  const cached = new Map<string, { name: string; year: number | null; posterUrl: string | null }>();
  if (titles.length) {
    const { data, error } = await db
      .from("titles")
      .select("kind, source, external_id, name, year, poster_path")
      .in("external_id", titles.map((t) => t.externalId));
    if (error) console.error(`titles read failed: ${error.message}`);
    for (const r of data ?? []) {
      if (r.source !== sourceForKind(r.kind as TitleKind)) continue;
      cached.set(titleKey(r.kind, r.external_id), { name: r.name, year: r.year, posterUrl: posterUrl(r.source, r.poster_path, "w342") });
    }
  }
  return subjects.flatMap((s): SubjectCard[] => {
    if (s.kind === "place") return [{ kind: "place", country: s.country, name: countryName(s.country, locale) }];
    const found = cached.get(titleKey(s.kind, s.externalId));
    return found ? [{ kind: s.kind, externalId: s.externalId, ...found }] : [];
  });
}

/** A published article as the Journal lists it, with its writer. */
export type ListedPost = WriterPost & { byline: Byline | null };

async function withBylines(db: UserClient, rows: Row[]): Promise<ListedPost[]> {
  const names = await bylines(db, rows.map((r) => r.user_id)).catch((error: unknown) => {
    console.error(error);
    return new Map<string, Byline>();
  });
  return rows.map((r) => ({ ...toPost(r), byline: names.get(r.user_id) ?? null }));
}

const published = (db: UserClient) =>
  db.from("journal_posts").select(COLUMNS).not("published_at", "is", null).is("hidden_at", null).is("deleted_at", null);

/**
 * The members' articles in a reader's Journal (ADR 0092): Featured ones, articles by the people they follow, and
 * their own published ones; in the reader's language or English (theirs always). Newest first.
 */
export async function journalPosts(db: UserClient, viewerId: string | null, locale: string, fallback: string): Promise<ListedPost[]> {
  const [featured, followed, own] = await Promise.all([
    published(db).eq("feature_request", "approved").order("published_at", { ascending: false }).limit(LIST_MAX),
    viewerId ? followedPosts(db, viewerId) : null,
    viewerId ? published(db).eq("user_id", viewerId).order("published_at", { ascending: false }).limit(LIST_MAX) : null,
  ]);
  for (const res of [featured, own]) if (res?.error) throw new Error(`journal_posts read failed: ${res.error.message}`);
  const rows = new Map<string, Row>();
  for (const r of [...(featured.data ?? []), ...(followed ?? [])]) if (r.locale === locale || r.locale === fallback) rows.set(r.id, r);
  for (const r of own?.data ?? []) rows.set(r.id, r);
  const list = [...rows.values()].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return withBylines(db, list);
}

/** The newest articles by the people the reader follows. */
async function followedPosts(db: UserClient, viewerId: string): Promise<Row[]> {
  const { data: follows, error } = await db.from("follows").select("followee_id").eq("follower_id", viewerId).is("deleted_at", null).limit(2000);
  if (error) throw new Error(`follows read failed: ${error.message}`);
  const ids = follows.map((f) => f.followee_id);
  if (ids.length === 0) return [];
  const { data, error: postsError } = await published(db).in("user_id", ids).order("published_at", { ascending: false }).limit(100);
  if (postsError) throw new Error(`journal_posts read failed: ${postsError.message}`);
  return data;
}

/** These published articles, where the reader can see them (their Saved ones from outside their Journal). */
export async function postsByIds(db: UserClient, ids: readonly string[]): Promise<ListedPost[]> {
  if (ids.length === 0) return [];
  const { data, error } = await published(db).in("id", ids.slice(0, LIST_MAX));
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  return withBylines(db, data);
}

/** Someone's published articles, newest first: their profile's Journal tab. */
export async function postsBy(db: UserClient, userId: string): Promise<ListedPost[]> {
  const { data, error } = await published(db).eq("user_id", userId).order("published_at", { ascending: false }).limit(LIST_MAX);
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  return withBylines(db, data);
}

/** Whether someone has published an article (their profile then has a Journal tab). */
export async function hasPosts(db: UserClient, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("journal_posts")
    .select("id")
    .eq("user_id", userId)
    .not("published_at", "is", null)
    .is("hidden_at", null)
    .is("deleted_at", null)
    .limit(1);
  if (error) {
    console.error(`journal_posts read failed: ${error.message}`);
    return false;
  }
  return data.length > 0;
}

/** Featured articles about a title or country (`movie:603`, `place:JP`), newest first: a title page's "In the Journal". */
export async function postsAbout(db: UserClient, key: string, limit = 3): Promise<ListedPost[]> {
  const { data, error } = await published(db)
    .eq("feature_request", "approved")
    .contains("subjects", [key])
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  return withBylines(db, data);
}

/** When the writer published their articles (ms): the Byline sticker (ADR 0063, ADR 0092). Taken-down ones don't count. */
export async function postTimes(db: UserClient, userId: string): Promise<number[]> {
  const { data, error } = await db
    .from("journal_posts")
    .select("published_at")
    .eq("user_id", userId)
    .not("published_at", "is", null)
    .is("hidden_at", null)
    .limit(LIST_MAX);
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  return data.flatMap((r) => (r.published_at ? [Date.parse(r.published_at)] : []));
}

/** Featured articles of public writers, for the sitemap (the rest stay out of search engines). */
export async function featuredForSitemap(admin: AdminClient): Promise<{ id: string; locale: string; at: string }[]> {
  const { data, error } = await admin
    .from("journal_posts")
    .select("id, user_id, locale, updated_at")
    .eq("feature_request", "approved")
    .not("published_at", "is", null)
    .is("hidden_at", null)
    .is("deleted_at", null)
    .order("featured_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  if (data.length === 0) return [];
  const { data: writers, error: writersError } = await admin
    .from("profiles")
    .select("id")
    .in("id", [...new Set(data.map((r) => r.user_id))])
    .eq("visibility", "public");
  if (writersError) throw new Error(`profiles read failed: ${writersError.message}`);
  const open = new Set(writers.map((w) => w.id));
  return data.filter((r) => open.has(r.user_id)).map((r) => ({ id: r.id, locale: r.locale, at: r.updated_at }));
}

// ---------------------------------------------------------------------------------------------------------------
// The team's review (admin page, service role).

export type QueuedPost = WriterPost & { body: string; byline: Byline | null; reports: { reason: string; note: string | null; at: string }[] };

/** Articles sent to be Featured and waiting, oldest first, and published articles with open reports. */
export async function reviewQueue(admin: AdminClient): Promise<{ pending: QueuedPost[]; reported: QueuedPost[] }> {
  const [pending, reports] = await Promise.all([
    admin
      .from("journal_posts")
      .select(WITH_BODY)
      .eq("feature_request", "pending")
      .not("published_at", "is", null)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(100),
    admin.from("reports").select("target_id, reason, note, created_at").eq("target_kind", "article").is("resolved_at", null).order("created_at").limit(200),
  ]);
  if (pending.error) throw new Error(`journal_posts read failed: ${pending.error.message}`);
  if (reports.error) throw new Error(`reports read failed: ${reports.error.message}`);
  const reportedIds = [...new Set(reports.data.map((r) => r.target_id))];
  const { data: reportedRows, error } = reportedIds.length
    ? await admin.from("journal_posts").select(WITH_BODY).in("id", reportedIds).is("deleted_at", null)
    : { data: [] as (Row & { body: string })[], error: null };
  if (error) throw new Error(`journal_posts read failed: ${error.message}`);
  const names = await bylines(admin, [...pending.data, ...reportedRows].map((r) => r.user_id));
  const byPost = new Map<string, QueuedPost["reports"]>();
  for (const r of reports.data) byPost.set(r.target_id, [...(byPost.get(r.target_id) ?? []), { reason: r.reason, note: r.note, at: r.created_at }]);
  const queued = (r: Row & { body: string }): QueuedPost => ({ ...toPost(r), body: r.body, byline: names.get(r.user_id) ?? null, reports: byPost.get(r.id) ?? [] });
  return { pending: pending.data.map(queued), reported: reportedRows.map(queued) };
}

/**
 * The team's answer: approve (Featured from now), decline (with a note to the writer), hide (taken down, its open
 * reports resolved) or unhide. False when there's no such article.
 */
export async function reviewPost(admin: AdminClient, id: string, action: ReviewAction, note: string | null): Promise<boolean> {
  const now = new Date().toISOString();
  const fields =
    action === "approve"
      ? { feature_request: "approved", featured_at: now, review_note: note }
      : action === "decline"
        ? { feature_request: "declined", featured_at: null, review_note: note }
        : action === "hide"
          ? { hidden_at: now, feature_request: null, featured_at: null, review_note: note }
          : { hidden_at: null };
  const { data, error } = await admin.from("journal_posts").update(fields).eq("id", id).is("deleted_at", null).select("id");
  if (error) throw new Error(`journal_posts review failed: ${error.message}`);
  if (data.length === 0) return false;
  if (action === "hide" || action === "unhide") {
    const { error: reportsError } = await admin.from("reports").update({ resolved_at: now }).eq("target_kind", "article").eq("target_id", id).is("resolved_at", null);
    if (reportsError) console.error(`reports resolve failed: ${reportsError.message}`);
  }
  return true;
}

/** Tells the team an article is waiting to be Featured (best effort, like reports: the row is what counts). */
export async function emailReviewRequest(post: WriterPost, writer: string | null): Promise<void> {
  const rendered = reviewRequestEmail({ title: post.title, writer }, new URL("/admin/journal", siteUrl()).toString());
  const email = { to: LEGAL.teamInbox, ...rendered };
  const config = emailConfig();
  try {
    if (config) await sendEmail(config, email, `feature-${post.id}-${post.updatedAt}`);
    else if (process.env.NODE_ENV === "development") await sendToLocalInbox(email);
  } catch (e) {
    console.error("review request email failed", e);
  }
}
