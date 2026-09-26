import type { TemplateProps } from "./parts";
import { BoldStatsCard } from "./templates/bold-stats";
import { PolaroidCard } from "./templates/polaroid";
import { TicketCard } from "./templates/ticket";

/** Stable template ids (used in `?tpl=` and analytics). Labels come from `Card.templates`. */
export const TEMPLATES = [{ id: "ticket" }, { id: "polaroid" }, { id: "boldStats" }] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const DEFAULT_TEMPLATE: TemplateId = "polaroid";

/** Renders one template by id. Add new templates here and to `TEMPLATES`. */
export function CardTemplate({ id, ...props }: TemplateProps & { id: TemplateId }) {
  switch (id) {
    case "ticket":
      return <TicketCard {...props} />;
    case "polaroid":
      return <PolaroidCard {...props} />;
    case "boldStats":
      return <BoldStatsCard {...props} />;
  }
}
