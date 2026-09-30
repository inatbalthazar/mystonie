import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, footerUser, Poster, useFinishedDate, useHeadline, type TemplateProps } from "../parts";

// The stone is always stone-coloured (not from the poster), so the carving reads the same on every card.
const STONE =
  "bg-[radial-gradient(circle_at_30%_22%,#d6d0c6_0,transparent_46%),radial-gradient(circle_at_78%_80%,#8a8278_0,transparent_52%),linear-gradient(160deg,#c3bcb1,#9d968b)]";
// Carved: dark ink with a light lip under it and a shadow above.
const CARVED = "text-[#3b3530] [text-shadow:0_-3px_1px_rgba(0,0,0,0.28),0_3px_1px_rgba(255,255,255,0.45)]";

/**
 * A milestone carved in stone (S2 milestones & recaps): Stonie's tablet with the number, what it counts and the
 * day, and the title that got there pasted in below. The brand's namesake moment ("my stone", ADR 0011).
 */
export function StoneCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const format = useFormatter();
  const date = useFinishedDate(data);
  const headline = useHeadline(data);
  const story = size === "story";
  const milestone = data.milestone;
  const value = milestone ? format.number(milestone.value) : "";
  const numberSize = [...value].length <= 3 ? (story ? "text-[300px]" : "text-[220px]") : [...value].length <= 5 ? (story ? "text-[230px]" : "text-[170px]") : story ? "text-[180px]" : "text-[136px]";

  return (
    <CardRoot size={size} palette={palette} className={cn("items-center p-[72px]", story ? "gap-[44px]" : "gap-[28px]")}>
      {/* The headline, stamped above the stone. */}
      <div className="max-w-full rotate-[-3deg] rounded-[16px] border-[6px] border-current px-[32px] py-[10px] text-[var(--card-text)]">
        <p className={cn(DISPLAY, "truncate text-[52px] leading-none font-extrabold tracking-[0.08em] uppercase [&:lang(th)]:tracking-normal")}>{headline}</p>
      </div>

      {/* The tablet: rounded top like a milestone, the number carved in. */}
      <div
        className={cn(
          "relative flex shrink-0 flex-col items-center justify-center gap-[12px] rounded-t-[50%_38%] rounded-b-[48px] px-[48px] shadow-[0_36px_60px_rgba(0,0,0,0.45),inset_0_-18px_0_rgba(0,0,0,0.12)]",
          STONE,
          story ? "h-[880px] w-[800px] pt-[80px]" : "h-[600px] w-[760px] pt-[48px]",
        )}
      >
        <p data-fit="" className={cn(DISPLAY, CARVED, "max-w-full font-extrabold tracking-[-0.04em] whitespace-nowrap [font-stretch:75%]", numberSize, "leading-[0.9]")}>
          {value}
        </p>
        {milestone && (
          <p className={cn(CARVED, "max-w-full truncate text-[44px] font-bold tracking-[0.16em] uppercase [&:lang(th)]:tracking-normal")}>
            {t("milestoneLabel", { metric: milestone.metric })}
          </p>
        )}
        <p className={cn(CARVED, "mt-[20px] text-[36px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase")}>{date}</p>
        {/* Stonie, proud of the carving. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- exported to PNG */}
        <img src="/icon.svg" alt="" className={cn("absolute -right-[56px] -bottom-[40px] rotate-[8deg]", story ? "size-[190px]" : "size-[150px]")} />
      </div>

      {/* The title that got there, pasted in with a caption. */}
      <div className="flex w-full min-w-0 flex-1 items-center gap-[40px] px-[12px]">
        <figure className={cn("relative shrink-0 rotate-[-4deg] bg-[var(--card-paper)] p-[12px] shadow-[0_16px_36px_rgba(0,0,0,0.35)]", story ? "w-[210px]" : "w-[150px]")}>
          <span className="absolute -top-[18px] left-1/2 z-10 h-[38px] w-[120px] -translate-x-1/2 rotate-[-5deg] bg-[var(--card-accent)] opacity-70" />
          <Poster url={data.posterUrl} className="aspect-[2/3] w-full" />
        </figure>
        <p className={cn("line-clamp-2 min-w-0 px-[8px] [overflow-wrap:anywhere] [font-family:var(--card-hand)]", story ? "text-[64px]" : "text-[52px]", "leading-[1.15]")}>
          {t("milestoneBy", { name: data.name })}
        </p>
      </div>

      <CardFooter host={host} username={footerUser(data)} className="w-full shrink-0" />
    </CardRoot>
  );
}
