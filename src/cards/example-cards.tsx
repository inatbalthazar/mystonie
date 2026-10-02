"use client";

import { ArrowDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CardData } from "@/core/cards/types";
import { cn } from "@/lib/utils";
import { CardPreview } from "./card-preview";
import { FINISH_TEMPLATES, type TemplateId } from "./registry";
import { usePosterPalette } from "./use-poster-palette";
import { Reveal } from "@/components/motion/reveal";

// Scrapbook fan: the middle card (the default template) in front, the others tilted behind it.
const FAN = [
  "z-0 -mr-6 mt-6 -rotate-[7deg]",
  "z-10 w-[40%]",
  "z-0 -ml-6 mt-6 rotate-[6deg]",
];

/**
 * First screen: one example per template, so people see the output before typing. Once the fan is dealt, the FINISHED
 * stamp lands on it, the moment a finish gets in the app (motion only; still, it's simply there).
 */
export function ExampleCards({ examples, host }: { examples: CardData[]; host: string }) {
  const t = useTranslations("Card");
  const th = useTranslations("Home");
  return (
    <section aria-label={t("examples")} className="flex w-full max-w-md flex-col items-center gap-4">
      <div className="relative w-full">
      <ul className="flex w-full items-start justify-center">
        {FINISH_TEMPLATES.map((id, i) => (
          // Dealt into the fan each time it's shown (ADR 0080), the middle card last, on top.
          <Reveal as="li" key={id} className={cn("deal flex w-[33%] shrink-0 flex-col items-center gap-2", FAN[i])} style={{ ["--grow-delay" as string]: `${[0, 160, 80][i] ?? 0}ms` }}>
            <div className="w-full overflow-hidden rounded-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
              <Example template={id} data={examples[i % examples.length]!} host={host} />
            </div>
            <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border">
              {t(`templates.${id}`)}
            </span>
          </Reveal>
        ))}
      </ul>
      <span
        aria-hidden="true"
        // animate-stamp ends tilted (-8deg); still, the same end state at once.
        className="absolute right-[6%] bottom-[14%] z-20 animate-stamp rounded-xl border-[3px] border-brand bg-background/85 p-[3px] text-brand shadow-[0_6px_16px_-6px_rgb(0_0_0/0.45)]"
        style={{ animationDelay: "900ms" }}
      >
        <span className="block rounded-[8px] border-[1.5px] border-brand px-3 py-1 font-display text-lg leading-none font-extrabold tracking-[0.14em] uppercase sm:text-xl">
          {t("finished")}
        </span>
      </span>
      </div>
      {/* To the card maker further down the page. */}
      <a href="#make" className="flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-brand underline-offset-4 hover:underline">
        {th("makeYourOwn")}
        <ArrowDownIcon className="size-4" aria-hidden="true" />
      </a>
    </section>
  );
}

function Example({ template, data, host }: { template: TemplateId; data: CardData; host: string }) {
  const palette = usePosterPalette(data.posterUrl);
  return <CardPreview template={template} data={data} size="story" palette={palette} host={host} />;
}
