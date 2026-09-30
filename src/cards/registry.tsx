import type { ComponentType } from "react";
import { isProTemplate, TEMPLATE_META, templatesFor, type TemplateId } from "@/core/cards/templates";
import type { TemplateProps } from "./parts";
import { BoldStatsCard } from "./templates/bold-stats";
import { CalendarCard } from "./templates/calendar";
import { CartridgeCard } from "./templates/cartridge";
import { CollageCard } from "./templates/collage";
import { FilmStripCard } from "./templates/film-strip";
import { MangaPanelCard } from "./templates/manga-panel";
import { PolaroidCard } from "./templates/polaroid";
import { SpineCard } from "./templates/spine";
import { StoneCard } from "./templates/stone";
import { StickerCard } from "./templates/sticker";
import { SurvivedCard } from "./templates/survived";
import { TicketCard } from "./templates/ticket";
import { YearbookCard } from "./templates/yearbook";

export type { TemplateId };

/**
 * Every template (id, kinds, sizes, tier: `src/core/cards/templates.ts`). Adding one = a component in
 * `templates/`, a line here, a metadata line in core and its label in `Card.templates`.
 */
const COMPONENTS: Record<TemplateId, ComponentType<TemplateProps>> = {
  ticket: TicketCard,
  polaroid: PolaroidCard,
  boldStats: BoldStatsCard,
  spine: SpineCard,
  mangaPanel: MangaPanelCard,
  cartridge: CartridgeCard,
  filmStrip: FilmStripCard,
  survived: SurvivedCard,
  collage: CollageCard,
  stone: StoneCard,
  calendar: CalendarCard,
  yearbook: YearbookCard,
  sticker: StickerCard,
};

export const TEMPLATES = TEMPLATE_META;

/** The card maker's templates (Finish cards for movies and series: it searches TMDB only). No Pro ones: no account there. */
export const FINISH_TEMPLATES = templatesFor("finish", "movie").filter((id) => !isProTemplate(id));

export const DEFAULT_TEMPLATE: TemplateId = "polaroid";

/** Renders one template by id. */
export function CardTemplate({ id, ...props }: TemplateProps & { id: TemplateId }) {
  const Template = COMPONENTS[id];
  return <Template {...props} />;
}
