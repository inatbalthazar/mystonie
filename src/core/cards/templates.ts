// Card template metadata (S1 share artwork: each template = React component + metadata). The components live
// in src/cards/templates and are mapped by id in src/cards/registry.tsx. The metadata lives here so the server
// can validate saved cards without React.
import type { CardKind, CardSize } from "./types";

export type TemplateTier = "free" | "pro";

export type TemplateMeta = {
  id: string;
  /** Which cards it can draw. `sticker` = transparent stats only. */
  kinds: readonly CardKind[];
  sizes: readonly CardSize[];
  tier: TemplateTier;
};

const BOTH_SIZES = ["story", "feed"] as const;

export const TEMPLATE_META = [
  { id: "ticket", kinds: ["finish"], sizes: BOTH_SIZES, tier: "free" },
  { id: "polaroid", kinds: ["finish", "progress"], sizes: BOTH_SIZES, tier: "free" },
  { id: "boldStats", kinds: ["finish", "progress", "weekly_recap", "stats"], sizes: BOTH_SIZES, tier: "free" },
  { id: "collage", kinds: ["weekly_recap", "stats"], sizes: BOTH_SIZES, tier: "free" },
  { id: "sticker", kinds: ["sticker"], sizes: BOTH_SIZES, tier: "free" },
] as const satisfies readonly TemplateMeta[];

export type TemplateId = (typeof TEMPLATE_META)[number]["id"];

export const TEMPLATE_IDS: readonly TemplateId[] = TEMPLATE_META.map((t) => t.id);

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

/** Templates that can draw `kind`, in display order. */
export function templatesFor(kind: CardKind): TemplateId[] {
  return TEMPLATE_META.filter((t) => (t.kinds as readonly CardKind[]).includes(kind)).map((t) => t.id);
}

export function templateFits(id: TemplateId, kind: CardKind, size: CardSize): boolean {
  const meta = TEMPLATE_META.find((t) => t.id === id);
  return !!meta && (meta.kinds as readonly CardKind[]).includes(kind) && (meta.sizes as readonly CardSize[]).includes(size);
}
