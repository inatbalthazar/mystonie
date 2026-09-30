// Card template metadata (S1 share artwork: each template = React component + metadata). The components live
// in src/cards/templates and are mapped by id in src/cards/registry.tsx. The metadata lives here so the server
// can validate saved cards without React.
import type { TitleKind } from "../catalog/types";
import type { CardKind, CardSize } from "./types";

export type TemplateTier = "free" | "pro";

export type TemplateMeta = {
  id: string;
  /** Which cards it can draw. `sticker` = transparent stats only. */
  kinds: readonly CardKind[];
  sizes: readonly CardSize[];
  tier: TemplateTier;
  /** Only for these titles (S2 books & manga: the spine and the manga panel; S3 games: the cartridge); every title when absent. */
  titleKinds?: readonly TitleKind[];
  /** Only for a finish DTDD says has a scare (S2 content warnings): offered by the celebration, not listed otherwise. */
  survived?: true;
};

const BOTH_SIZES = ["story", "feed"] as const;

export const TEMPLATE_META = [
  { id: "ticket", kinds: ["finish"], sizes: BOTH_SIZES, tier: "free" },
  { id: "polaroid", kinds: ["finish", "progress"], sizes: BOTH_SIZES, tier: "free" },
  {
    id: "boldStats",
    kinds: ["finish", "progress", "weekly_recap", "monthly_recap", "stats", "year_review", "milestone", "challenge"],
    sizes: BOTH_SIZES,
    tier: "free",
  },
  { id: "spine", kinds: ["finish", "progress"], sizes: BOTH_SIZES, tier: "free", titleKinds: ["book", "manga"] },
  { id: "mangaPanel", kinds: ["finish", "progress"], sizes: BOTH_SIZES, tier: "free", titleKinds: ["manga"] },
  // S3 games: a cartridge taped into the album, the key art on its label (landscape, as RAWG draws it).
  { id: "cartridge", kinds: ["finish"], sizes: BOTH_SIZES, tier: "free", titleKinds: ["game"] },
  // Pro (S2 Pro, ADR 0034): a strip of 35 mm film pasted into the album. Movies and series.
  { id: "filmStrip", kinds: ["finish", "progress"], sizes: BOTH_SIZES, tier: "pro", titleKinds: ["movie", "series"] },
  // S2 content warnings: a merit patch for sitting through the jump scares (or the zombies, the clowns, …).
  { id: "survived", kinds: ["finish"], sizes: BOTH_SIZES, tier: "free", titleKinds: ["movie", "series"], survived: true },
  { id: "collage", kinds: ["weekly_recap", "monthly_recap", "stats", "year_review"], sizes: BOTH_SIZES, tier: "free" },
  { id: "stone", kinds: ["milestone"], sizes: BOTH_SIZES, tier: "free" },
  // S3 challenges & clubs: the month's calendar page, torn off, with the days you logged circled.
  { id: "calendar", kinds: ["challenge"], sizes: BOTH_SIZES, tier: "free" },
  { id: "yearbook", kinds: ["year_review"], sizes: BOTH_SIZES, tier: "free" },
  { id: "sticker", kinds: ["sticker"], sizes: BOTH_SIZES, tier: "free" },
] as const satisfies readonly TemplateMeta[];

export type TemplateId = (typeof TEMPLATE_META)[number]["id"];

export const TEMPLATE_IDS: readonly TemplateId[] = TEMPLATE_META.map((t) => t.id);

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

/** Whether the template is Pro-only (hidden when Pro isn't available, locked for non-Pro users). */
export function isProTemplate(id: TemplateId): boolean {
  return TEMPLATE_META.find((t) => t.id === id)?.tier === "pro";
}

const drawsTitle = (meta: TemplateMeta, titleKind: TitleKind) => !meta.titleKinds || meta.titleKinds.includes(titleKind);

/** Whether the template draws only Survived cards. */
export function isSurvivedTemplate(id: TemplateId): boolean {
  const meta: TemplateMeta | undefined = TEMPLATE_META.find((t) => t.id === id);
  return meta?.survived === true;
}

/**
 * Templates that can draw a `kind` card about a `titleKind` title, in display order. The Survived template only
 * when `survived` (the finish has a scare to survive), and then first.
 */
export function templatesFor(kind: CardKind, titleKind: TitleKind, { survived = false }: { survived?: boolean } = {}): TemplateId[] {
  const ids = TEMPLATE_META.filter((t) => (t.kinds as readonly CardKind[]).includes(kind) && drawsTitle(t, titleKind)).map((t) => t.id);
  return [...ids.filter((id) => survived && isSurvivedTemplate(id)), ...ids.filter((id) => !isSurvivedTemplate(id))];
}

export function templateFits(id: TemplateId, kind: CardKind, size: CardSize, titleKind: TitleKind): boolean {
  const meta: TemplateMeta | undefined = TEMPLATE_META.find((t) => t.id === id);
  return !!meta && (meta.kinds as readonly CardKind[]).includes(kind) && (meta.sizes as readonly CardSize[]).includes(size) && drawsTitle(meta, titleKind);
}

/**
 * The template a new card opens on: the manga panel for manga and the spine for books (Finish and Progress), the
 * cartridge for a game's finish, else the Polaroid for a finish, Bold Stats for progress and stats, the collage for a week or a month, the
 * carved stone for a milestone, the calendar for a challenge and the yearbook for a Year in Review.
 */
export function defaultTemplate(kind: CardKind, titleKind: TitleKind): TemplateId {
  if (kind === "sticker") return "sticker";
  if (kind === "weekly_recap" || kind === "monthly_recap") return "collage";
  if (kind === "stats") return "boldStats";
  if (kind === "milestone") return "stone";
  if (kind === "challenge") return "calendar";
  if (kind === "year_review") return "yearbook";
  if (titleKind === "manga") return "mangaPanel";
  if (titleKind === "book") return "spine";
  if (titleKind === "game" && kind === "finish") return "cartridge";
  return kind === "finish" ? "polaroid" : "boldStats";
}
