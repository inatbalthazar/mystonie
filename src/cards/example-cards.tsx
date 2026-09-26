"use client";

import { useTranslations } from "next-intl";
import type { CardData } from "@/core/cards/types";
import { CardPreview } from "./card-preview";
import { TEMPLATES, type TemplateId } from "./registry";
import { usePosterPalette } from "./use-poster-palette";

/** First screen: one example per template, so people see the output before typing. */
export function ExampleCards({ examples, host }: { examples: CardData[]; host: string }) {
  const t = useTranslations("Card");
  return (
    <section className="flex w-full max-w-2xl flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{t("examples")}</h2>
      <ul className="grid grid-cols-3 gap-3">
        {TEMPLATES.map(({ id }, i) => (
          <li key={id} className="flex flex-col gap-1">
            <Example template={id} data={examples[i % examples.length]!} host={host} />
            <span className="text-center text-xs text-muted-foreground">{t(`templates.${id}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Example({ template, data, host }: { template: TemplateId; data: CardData; host: string }) {
  const palette = usePosterPalette(data.posterUrl);
  return <CardPreview template={template} data={data} size="story" palette={palette} host={host} />;
}
