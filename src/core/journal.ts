// The Journal (stage 4, ADR 0051): articles written by the Mystonie team as Markdown files in content/journal/, one
// folder per article and one file per language (`en.md`, `th.md`). This is the small Markdown subset they may use,
// parsed into blocks the page renders with React (no HTML from the file ever reaches the page).
import { USERNAME_RE } from "./account";
import { isExternalId, isTitleKind, type TitleKind } from "./catalog/types";

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] }
  | { type: "rule" }
  | { type: "image"; src: string; alt: string }
  /** `@[movie:603](The Matrix)` on its own line: the title as a card with Add (the label is used when it can't load). */
  | { type: "title"; kind: TitleKind; externalId: string; label: string | null };

export type JournalMeta = {
  title: string;
  description: string;
  /** `YYYY-MM-DD`, the day it was published. */
  date: string;
  /** An image under /journal/ or an https URL, shown on top and in link previews. */
  cover: string | null;
  author: string | null;
  /** The writer's photo for the byline (under /journal/ or https); without one, their initial, or Stonie for the team. */
  avatar: string | null;
  /** The writer's Mystonie username: the byline links to their page. */
  profile: string | null;
  /** On the Journal's Featured tab, and a little higher in For you (ADR 0052). */
  featured: boolean;
  /** Drafts show only outside production. */
  draft: boolean;
};

export type JournalArticle = { meta: JournalMeta; blocks: Block[] };

export class JournalError extends Error {}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isJournalSlug = (v: unknown): v is string => typeof v === "string" && v.length <= 80 && SLUG_RE.test(v);

/** Links may go to our own pages (`/…`), the web (http, https) or an email address. */
export function isSafeHref(href: string): boolean {
  if (href.startsWith("/")) return !href.startsWith("//") && !href.includes("\\");
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(href);
}

/** Images come from public/journal/ or an https URL. */
export function isSafeImage(src: string): boolean {
  if (src.startsWith("/journal/")) return !src.includes("..") && !src.includes("\\");
  return /^https:\/\/[^\s]+$/i.test(src);
}

function validDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

/** A frontmatter value: the text inside quotes, else the text before a ` # comment` (as in YAML). */
function unquote(v: string): string {
  const t = v.trim();
  const quote = t[0] === '"' || t[0] === "'" ? t[0] : null;
  if (quote) {
    const close = t.indexOf(quote, 1);
    if (close > 0) return t.slice(1, close);
  }
  return t.replace(/\s+#.*$/, "");
}

/** The `---`-fenced `key: value` lines on top of an article. */
function parseFrontmatter(lines: string[]): { meta: JournalMeta; rest: string[] } {
  if (lines[0]?.trim() !== "---") throw new JournalError("an article starts with --- and its title, description and date");
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) throw new JournalError("the frontmatter has no closing ---");
  const fields = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = /^([a-z]+):\s*(.*)$/.exec(line.trim());
    if (!m) throw new JournalError(`frontmatter line not understood: ${line}`);
    fields.set(m[1]!, unquote(m[2]!));
  }
  const title = fields.get("title") ?? "";
  const description = fields.get("description") ?? "";
  const date = fields.get("date") ?? "";
  const cover = fields.get("cover") || null;
  if (!title) throw new JournalError("title is missing");
  if (!description) throw new JournalError("description is missing");
  if (!validDate(date)) throw new JournalError("date must be YYYY-MM-DD");
  if (cover && !isSafeImage(cover)) throw new JournalError("cover must be under /journal/ or https");
  const avatar = fields.get("avatar") || null;
  if (avatar && !isSafeImage(avatar)) throw new JournalError("avatar must be under /journal/ or https");
  const profile = fields.get("profile")?.replace(/^@/, "").toLowerCase() || null;
  if (profile && !USERNAME_RE.test(profile)) throw new JournalError("profile is a Mystonie username (3 to 20 of a-z, 0-9 and _)");
  const flag = (key: "draft" | "featured") => {
    const v = fields.get(key);
    if (v !== undefined && v !== "true" && v !== "false") throw new JournalError(`${key} is true or false`);
    return v === "true";
  };
  return {
    meta: { title, description, date, cover, author: fields.get("author") || null, avatar, profile, featured: flag("featured"), draft: flag("draft") },
    rest: lines.slice(end + 1),
  };
}

/** `**strong**`, `*em*` / `_em_`, `` `code` `` and `[text](href)`; anything else is text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ type: "text", text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if (rest.startsWith("\\") && rest.length > 1 && /[\\*_`[\]()@]/.test(rest[1]!)) {
      text += rest[1];
      i += 2;
    } else if ((m = /^\*\*(.+?)\*\*/.exec(rest))) {
      flush();
      out.push({ type: "strong", children: parseInline(m[1]!) });
      i += m[0].length;
    } else if ((m = /^\*([^*\s](?:[^*]*[^*\s])?)\*/.exec(rest)) || (m = /^_([^_\s](?:[^_]*[^_\s])?)_(?![\p{L}\p{N}])/u.exec(rest))) {
      flush();
      out.push({ type: "em", children: parseInline(m[1]!) });
      i += m[0].length;
    } else if ((m = /^`([^`]+)`/.exec(rest))) {
      flush();
      out.push({ type: "code", text: m[1]! });
      i += m[0].length;
    } else if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest)) && isSafeHref(m[2]!)) {
      flush();
      out.push({ type: "link", href: m[2]!, children: parseInline(m[1]!) });
      i += m[0].length;
    } else {
      text += rest[0];
      i += 1;
    }
  }
  flush();
  return out;
}

const TITLE_RE = /^@\[([a-z]+):([A-Za-z0-9_-]+)\](?:\(([^)]*)\))?$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const LIST_RE = /^(?:([-*])|(\d+)\.)\s+(.*)$/;

/** Blocks are separated by blank lines; a paragraph's lines join with a space. */
function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) });
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    if (quote.length) blocks.push({ type: "quote", children: parseInline(quote.join(" ")) });
    para = [];
    list = null;
    quote = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^(#{2,3})\s+(.+)$/.exec(line))) {
      flush();
      blocks.push({ type: "heading", level: m[1]!.length as 2 | 3, children: parseInline(m[2]!) });
    } else if (/^(?:-{3,}|\*{3,})$/.test(line)) {
      flush();
      blocks.push({ type: "rule" });
    } else if ((m = TITLE_RE.exec(line))) {
      const [, kind, id, label] = m;
      if (!isTitleKind(kind) || !isExternalId(kind, id)) throw new JournalError(`not a title: ${line}`);
      flush();
      blocks.push({ type: "title", kind, externalId: id!, label: label?.trim() || null });
    } else if ((m = IMAGE_RE.exec(line))) {
      if (!isSafeImage(m[2]!)) throw new JournalError(`images come from /journal/ or https: ${line}`);
      flush();
      blocks.push({ type: "image", src: m[2]!, alt: m[1]!.trim() });
    } else if (line.startsWith(">")) {
      if (para.length || list) flush();
      quote.push(line.replace(/^>\s?/, ""));
    } else if ((m = LIST_RE.exec(line))) {
      const ordered = m[2] !== undefined;
      if (para.length || quote.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(m[3]!);
    } else if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line}`; // a list item's wrapped line
    } else {
      if (list || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** One article file: frontmatter, then the Markdown subset above. Throws `JournalError` on a mistake in the file. */
export function parseJournal(source: string): JournalArticle {
  const lines = source.replace(/^﻿/, "").split(/\r?\n/);
  const { meta, rest } = parseFrontmatter(lines);
  const blocks = parseBlocks(rest);
  if (blocks.length === 0) throw new JournalError("the article has no text");
  return { meta, blocks };
}

/** The titles an article shows as cards, once each, in order. */
export function journalTitles(blocks: readonly Block[]): { kind: TitleKind; externalId: string }[] {
  const seen = new Set<string>();
  const out: { kind: TitleKind; externalId: string }[] = [];
  for (const b of blocks) {
    if (b.type !== "title" || seen.has(`${b.kind}:${b.externalId}`)) continue;
    seen.add(`${b.kind}:${b.externalId}`);
    out.push({ kind: b.kind, externalId: b.externalId });
  }
  return out;
}

function inlineText(nodes: readonly Inline[]): string {
  return nodes.map((n) => (n.type === "text" || n.type === "code" ? n.text : inlineText(n.children))).join("");
}

/** The article's text without markup (for the reading time). */
export function plainText(blocks: readonly Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === "list") return b.items.map(inlineText).join(" ");
      if (b.type === "heading" || b.type === "paragraph" || b.type === "quote") return inlineText(b.children);
      return b.type === "title" ? (b.label ?? "") : "";
    })
    .join(" ");
}

/**
 * Minutes to read, at least 1: about 230 words a minute for space-separated scripts; Thai, Chinese and Japanese
 * have no spaces between words, so their characters count at about 700 a minute.
 */
export function readingMinutes(blocks: readonly Block[]): number {
  const text = plainText(blocks);
  const unspaced = (text.match(/[฀-๿぀-ヿ一-鿿]/gu) ?? []).length;
  const words = text.replace(/[฀-๿぀-ヿ一-鿿]+/gu, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230 + unspaced / 700));
}

export type JournalVersion = { slug: string; locale: string; meta: JournalMeta };

/**
 * The version of each article to list for `locale`: its own language when written, else English (`fallback`), else
 * whichever exists; drafts only when `drafts`. Newest first, then by slug.
 */
export function journalIndex<T extends JournalVersion>(versions: readonly T[], locale: string, fallback: string, drafts: boolean): T[] {
  const bySlug = new Map<string, T[]>();
  for (const v of versions) if (drafts || !v.meta.draft) bySlug.set(v.slug, [...(bySlug.get(v.slug) ?? []), v]);
  const picked = [...bySlug.values()].map(
    (list) => list.find((v) => v.locale === locale) ?? list.find((v) => v.locale === fallback) ?? [...list].sort((a, b) => a.locale.localeCompare(b.locale))[0]!,
  );
  return picked.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || a.slug.localeCompare(b.slug));
}
