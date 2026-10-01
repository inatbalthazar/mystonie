import { CheckIcon, XIcon } from "lucide-react";
import { useFormatter } from "next-intl";
import { REEL_GUESSES } from "@/core/reel";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, footerUser, useCardName, useHeadline, useStats, type TemplateProps } from "../parts";

/**
 * Reel of the Day (stage 4 daily game): a contact sheet of six film frames, one per guess, lit red for a miss and
 * green for the hit, the rest left dark. Spoiler-free: no poster, no name, only the reel's number and the score.
 */
export function ReelCard({ data, size, palette, host }: TemplateProps) {
  const format = useFormatter();
  const headline = useHeadline(data);
  const name = useCardName(data);
  const stats = useStats(data);
  const story = size === "story";
  const results = data.reel?.results ?? [];
  const day = data.reel?.day ?? data.finishedOn;
  const frames = Array.from({ length: REEL_GUESSES }, (_, i) => results[i]);

  return (
    <CardRoot size={size} palette={palette} className={cn("px-[72px] pb-[64px]", story ? "gap-[56px] pt-[110px]" : "gap-[30px] pt-[64px]")}>
      <header className="flex flex-col gap-[12px]">
        <p className="text-[36px] font-bold tracking-[0.25em] text-[var(--card-accent)] uppercase [&:lang(th)]:tracking-normal">{headline}</p>
        <p data-fit="" className={cn(DISPLAY, "truncate font-extrabold tracking-[-0.04em] [font-stretch:75%]", story ? "text-[190px]" : "text-[150px]", "leading-[0.9]")}>
          {name}
        </p>
        <p className="text-[34px] text-[var(--card-muted)]">
          {format.dateTime(new Date(`${day}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" })}
        </p>
      </header>

      {/* The strip: sprocket holes along both edges, three frames a row. */}
      <div className="relative -rotate-[1.5deg] rounded-[12px] bg-[#141414] px-[34px] py-[44px] shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
        {[0, 1].map((edge) => (
          <div key={edge} className={cn("absolute inset-x-[20px] flex justify-between", edge === 0 ? "top-[12px]" : "bottom-[12px]")}>
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="h-[20px] w-[30px] rounded-[5px] bg-[#e8e2d4]/85" />
            ))}
          </div>
        ))}
        <div className="grid grid-cols-3 gap-[20px]">
          {frames.map((hit, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center rounded-[8px]",
                story ? "h-[300px]" : "h-[190px]",
                hit === true ? "bg-[#2f9e5b]" : hit === false ? "bg-[#d0432f]" : "bg-[#2a2a2a]",
              )}
            >
              {hit === true && <CheckIcon aria-hidden="true" strokeWidth={3} className="size-[96px] text-white" />}
              {hit === false && <XIcon aria-hidden="true" strokeWidth={3} className="size-[80px] text-white/90" />}
            </div>
          ))}
        </div>
      </div>

      {stats.length > 0 && (
        <dl className={cn("mt-auto grid gap-[32px] border-t-[4px] border-[var(--card-text)]/20 pt-[32px]", stats.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dd data-fit="" className={cn(DISPLAY, "font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]", story ? "text-[150px]" : "text-[112px]", "leading-[0.9]")}>
                {s.value}
              </dd>
              <dt className="mt-[10px] truncate text-[30px] tracking-[0.12em] text-[var(--card-muted)] uppercase [&:lang(th)]:tracking-normal">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}

      <CardFooter host={host} {...footerUser(data)} className="relative shrink-0" />
    </CardRoot>
  );
}
