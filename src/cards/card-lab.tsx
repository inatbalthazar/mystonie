"use client";

import { useEffect } from "react";
import { CARD_DIMENSIONS, type CardSize } from "@/core/cards/types";
import { renderCardPng } from "./export";
import { CardPreview } from "./card-preview";
import { CARD_FIXTURES } from "./fixtures";
import { templatesFor } from "@/core/cards/templates";
import type { TemplateId } from "./registry";
import { usePosterPalette } from "./use-poster-palette";
import type { CardData, CardKind } from "@/core/cards/types";

/** Which card a fixture is: its template list comes from the card kind. */
function labKind(data: CardData): CardKind {
  if (data.milestone) return "milestone";
  if (data.challenge) return "challenge";
  if (data.reel) return "reel";
  if (data.atlas) return "atlas";
  if (data.shelf) return "shelf";
  if (data.recap?.highlights) return "year_review";
  if (data.recap?.period === "month") return "monthly_recap";
  if (data.recap) return "weekly_recap";
  return data.progress || data.reading ? "progress" : "finish";
}

/** Dev-only grid of every template × size × fixture (screenshot tests run against it). */
export function CardLab({ host }: { host: string }) {
  // Lets the screenshot tests export a card through the real PNG path: `await __exportCard("korean.ticket.story")`.
  useEffect(() => {
    Object.assign(window, {
      __exportCard: async (testId: string) => {
        const node = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
        if (!node) throw new Error(`No card ${testId}`);
        const blob = await renderCardPng(node, testId.endsWith(".feed") ? "feed" : "story");
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
        return dataUrl.slice(dataUrl.indexOf(",") + 1);
      },
    });
  }, []);

  return (
    <div className="flex flex-col gap-10 p-4">
      {CARD_FIXTURES.map((f) => (
        <section key={f.id} className="flex flex-col gap-2">
          <h2 className="font-mono text-sm">{f.id}</h2>
          <div className="flex flex-wrap items-start gap-4">
            {[...templatesFor(labKind(f.data), f.data.kind, { survived: !!f.data.survived }), ...templatesFor("sticker", f.data.kind)].flatMap((id) =>
              (Object.keys(CARD_DIMENSIONS) as CardSize[]).map((size) => (
                <div key={`${id}-${size}`} data-testid={`${f.id}.${id}.${size}`} className="w-[216px]">
                  <LabCard template={id} size={size} data={f.data} host={host} />
                </div>
              )),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function LabCard(props: { template: TemplateId; size: CardSize; data: CardData; host: string }) {
  const palette = usePosterPalette(props.data.posterUrl);
  return <CardPreview {...props} palette={palette} />;
}
