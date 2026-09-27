import type { ComponentType } from "react";
import { TEMPLATE_META, templatesFor, type TemplateId } from "@/core/cards/templates";
import type { TemplateProps } from "./parts";
import { BoldStatsCard } from "./templates/bold-stats";
import { CollageCard } from "./templates/collage";
import { PolaroidCard } from "./templates/polaroid";
import { StickerCard } from "./templates/sticker";
import { TicketCard } from "./templates/ticket";

export type { TemplateId };

/**
 * Every template (id, kinds, sizes, tier: `src/core/cards/templates.ts`). Adding one = a component in
 * `templates/`, a line here, a metadata line in core and its label in `Card.templates`.
 */
const COMPONENTS: Record<TemplateId, ComponentType<TemplateProps>> = {
  ticket: TicketCard,
  polaroid: PolaroidCard,
  boldStats: BoldStatsCard,
  collage: CollageCard,
  sticker: StickerCard,
};

export const TEMPLATES = TEMPLATE_META;

/** The card maker's templates (Finish cards). */
export const FINISH_TEMPLATES = templatesFor("finish");

export const DEFAULT_TEMPLATE: TemplateId = "polaroid";

/** Renders one template by id. */
export function CardTemplate({ id, ...props }: TemplateProps & { id: TemplateId }) {
  const Template = COMPONENTS[id];
  return <Template {...props} />;
}
