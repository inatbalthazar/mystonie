import {
  BadgeQuestionMarkIcon,
  BookmarkIcon,
  BookOpenIcon,
  CheckIcon,
  ClapperboardIcon,
  Gamepad2Icon,
  MessageCircleIcon,
  StampIcon,
  TriangleAlertIcon,
  TvIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Sticker } from "@/components/badges/sticker";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import type { BadgeId } from "@/core/badges";
import { cn } from "@/lib/utils";
import { AtlasArt } from "./atlas-art";
import { InstallButton } from "./install-button";

/** A title the pictures borrow: this week's trending ones, or the card lab's when trending is down. */
export type ShowTitle = { name: string; posterUrl: string | null };

const KINDS: ["movie" | "series" | "book" | "manga" | "game", LucideIcon][] = [
  ["movie", ClapperboardIcon],
  ["series", TvIcon],
  ["book", BookOpenIcon],
  ["manga", MessageCircleIcon],
  ["game", Gamepad2Icon],
];

const mark = (chunks: ReactNode) => <span className="text-brand">{chunks}</span>;

/** What you can log, as label-maker tape under the hero. */
export async function KindTape() {
  const t = await getTranslations("Home");
  return (
    <ul aria-label={t("kindsLabel")} className="flex flex-wrap justify-center gap-2">
      {KINDS.map(([kind, Icon], i) => (
        <li
          key={kind}
          className={cn(
            "flex items-center gap-1.5 rounded-[4px] bg-card px-2.5 py-1 text-sm font-semibold shadow-[0_1px_1px_rgb(0_0_0/0.06),0_4px_10px_-6px_rgb(0_0_0/0.3)] ring-1 ring-border",
            i % 2 ? "rotate-[1.5deg]" : "-rotate-[1.5deg]",
          )}
        >
          <Icon aria-hidden="true" className="size-4 text-brand" strokeWidth={2.25} />
          {t(`kinds.${kind}`)}
        </li>
      ))}
    </ul>
  );
}

/**
 * The landing page's tour of the app: one scrapbook page per part, a heading and a line on the page with a picture
 * of it next to them (a taped list, a ticket stub, a map, stickers, a feed post, a warning slip). The pictures are
 * made of the app's own parts with sample numbers, so they're decoration: the words carry the meaning.
 */
export async function FeaturePages({ titles }: { titles: ShowTitle[] }) {
  const t = await getTranslations("Home");
  const at = (i: number) => titles[i % titles.length]!;
  return (
    <div className="flex w-full max-w-2xl flex-col gap-20 sm:gap-24">
      <Spread title={t.rich("logTitle", { mark })} body={t("logBody")} art={<LogArt titles={[at(0), at(1), at(2)]} />} />
      <Spread title={t.rich("statsTitle", { mark })} body={t("statsBody")} art={<StatsArt />} flip />
      <Spread title={t.rich("atlasTitle", { mark })} body={t("atlasBody")} art={<AtlasArt />} />
      <Spread title={t.rich("stickersTitle", { mark })} body={t("stickersBody")} art={<StickersArt />} flip />
      <Spread title={t.rich("friendsTitle", { mark })} body={t("friendsBody")} art={<FriendsArt post={at(3)} reel={at(4)} />} />
      <Spread title={t.rich("warningsTitle", { mark })} body={t("warningsBody")} art={<WarningsArt />} flip />
      <InstallPage />
    </div>
  );
}

function Spread({ title, body, art, flip }: { title: ReactNode; body: string; art: ReactNode; flip?: boolean }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 sm:grid-cols-2 sm:gap-10">
      <div className={cn("flex min-w-0 flex-col gap-3", flip && "sm:order-2")}>
        <h2 className="font-display text-[2.125rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance sm:text-[2.5rem]">{title}</h2>
        <p className="max-w-[34ch] text-base text-pretty text-muted-foreground">{body}</p>
      </div>
      <div aria-hidden="true" className="min-w-0 px-2">
        {art}
      </div>
    </section>
  );
}

/** A strip of tape holding a picture to the page. */
function Tape({ className }: { className?: string }) {
  return <span className={cn("absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 rounded-[2px] bg-brand-soft/90 shadow-sm ring-1 ring-brand/10", className)} />;
}

function Poster({ title, className }: { title: ShowTitle; className?: string }) {
  return title.posterUrl ? (
    <Image src={title.posterUrl} alt="" width={92} height={138} unoptimized crossOrigin="anonymous" className={cn("aspect-[2/3] shrink-0 rounded-md object-cover", className)} />
  ) : (
    <span className={cn("aspect-[2/3] shrink-0 rounded-md bg-muted", className)} />
  );
}

/** The collection: a series halfway, a movie just finished, one saved for later. */
async function LogArt({ titles }: { titles: ShowTitle[] }) {
  const t = await getTranslations("Home");
  const tc = await getTranslations("Card");
  const [watching, finished, later] = titles as [ShowTitle, ShowTitle, ShowTitle];
  return (
    <Reveal className="rise relative mx-auto max-w-sm -rotate-[1.5deg] rounded-2xl bg-card p-3 pt-5 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_14px_32px_-14px_rgb(0_0_0/0.35)] ring-1 ring-border">
      <Tape className="-rotate-3" />
      <ul className="flex flex-col divide-y divide-border">
        <li className="flex items-center gap-3 py-2.5">
          <Poster title={watching} className="w-11" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-sm font-semibold">{watching.name}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="grow-w block h-full rounded-full bg-brand" style={{ width: "62%", ["--grow-delay" as string]: "300ms" }} />
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{t("logProgress", { watched: 26, total: 42 })}</span>
          </span>
        </li>
        <li className="flex items-center gap-3 py-2.5">
          <Poster title={finished} className="w-11" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{finished.name}</span>
          <span className="grow-pop shrink-0 -rotate-[8deg] rounded-md border-2 border-brand px-1.5 py-0.5 font-display text-[11px] font-extrabold tracking-[0.14em] text-brand uppercase" style={{ ["--grow-delay" as string]: "600ms" }}>
            {tc("finished")}
          </span>
        </li>
        <li className="flex items-center gap-3 py-2.5">
          <Poster title={later} className="w-11" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{later.name}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            <BookmarkIcon className="size-3.5 fill-current" />
            {t("logWant")}
          </span>
        </li>
      </ul>
    </Reveal>
  );
}

/** Twelve months of watch time; the busiest in coral. */
const MONTHS = [38, 52, 30, 64, 46, 72, 58, 100, 66, 48, 80, 60];

/** Stats as a ticket stub: three big numbers, the perforation, then the months growing. */
async function StatsArt() {
  const t = await getTranslations("Home");
  const numbers: [string, string][] = [
    ["312", t("statsHours")],
    ["86", t("statsFinished")],
    ["1,204", t("statsEpisodes")],
  ];
  return (
    <Reveal className="rise relative mx-auto max-w-sm rotate-[1.5deg] rounded-2xl bg-foreground p-5 text-background shadow-[0_18px_40px_-16px_rgb(0_0_0/0.55)]">
      <p className="font-display text-sm font-bold tracking-[0.16em] uppercase opacity-70">{t("statsYear")}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {numbers.map(([value, label]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="mt-1 text-xs leading-tight opacity-75">{label}</dt>
            <dd className="font-display text-[2rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
              <CountUp value={value} />
            </dd>
          </div>
        ))}
      </dl>
      {/* The tear line, with the stub's notches. */}
      <div className="relative -mx-5 my-4 border-t-2 border-dashed border-background/25">
        <span className="absolute -top-3 -left-3 size-6 rounded-full bg-background" />
        <span className="absolute -top-3 -right-3 size-6 rounded-full bg-background" />
      </div>
      <div className="flex h-20 items-end gap-1.5">
        {MONTHS.map((h, i) => (
          <span
            key={i}
            className={cn("grow-h flex-1 rounded-t-[3px]", h === 100 ? "bg-brand" : "bg-background/30")}
            style={{ height: `${h}%`, ["--grow-delay" as string]: `${200 + i * 45}ms` }}
          />
        ))}
      </div>
    </Reveal>
  );
}

const STICKERS: { id: BadgeId; tilt: string }[] = [
  { id: "first-movie", tilt: "-rotate-6" },
  { id: "binge-master", tilt: "rotate-3 translate-y-3" },
  { id: "film-buff", tilt: "-rotate-2" },
  { id: "bookworm", tilt: "rotate-6 translate-y-2" },
  { id: "level-up", tilt: "-rotate-3 -translate-y-1" },
  { id: "reel-legend", tilt: "rotate-2 translate-y-3" },
];

/** Stickers stuck loose on the page, each with its name in pen. */
async function StickersArt() {
  const t = await getTranslations("Badges");
  return (
    <Reveal className="mx-auto grid max-w-sm grid-cols-3 gap-x-3 gap-y-6">
      {STICKERS.map(({ id, tilt }, i) => (
        <span key={id} className={cn("grow-pop flex flex-col items-center gap-1.5", tilt)} style={{ ["--grow-delay" as string]: `${i * 90}ms` }}>
          <Sticker id={id} size="lg" className="max-sm:size-20" />
          <span className="text-center font-[family-name:var(--font-caveat)] text-xl leading-none">{t(`items.${id}.name`)}</span>
        </span>
      ))}
    </Reveal>
  );
}

/** A friend's finish in the feed, with Stamp, and today's Reel of the Day taped over its corner. */
async function FriendsArt({ post, reel }: { post: ShowTitle; reel: ShowTitle }) {
  const t = await getTranslations("Home");
  const tr = await getTranslations("Reel");
  const ts = await getTranslations("Social");
  return (
    <div className="mx-auto flex max-w-sm flex-col">
      <Reveal className="rise relative w-[88%] -rotate-[1.5deg] rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_14px_32px_-14px_rgb(0_0_0/0.35)] ring-1 ring-border">
        <span className="flex items-center gap-2">
          <Image src="/icon.svg" alt="" width={32} height={32} unoptimized className="size-8 rounded-full bg-brand-soft" />
          <span className="min-w-0 text-sm">{t.rich("friendsPost", { b: (c) => <b className="font-semibold">{c}</b>, title: post.name })}</span>
        </span>
        <span className="mt-3 flex gap-3">
          <Poster title={post} className="w-16" />
          <span className="flex flex-col justify-end gap-2">
            <span className="flex gap-0.5 text-brand">
              {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
                </svg>
              ))}
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 self-start rounded-full bg-brand px-3.5 text-sm font-semibold text-brand-foreground">
              <StampIcon className="size-4" />
              {ts("stamp")}
            </span>
          </span>
        </span>
      </Reveal>
      <Reveal
        className="rise relative -mt-4 w-[52%] self-end rotate-[4deg] rounded-xl bg-card p-2.5 shadow-[0_18px_36px_-14px_rgb(0_0_0/0.5)] ring-1 ring-border"
        style={{ ["--grow-delay" as string]: "200ms" }}
      >
        <Tape className="w-14 rotate-6" />
        <span className="relative block aspect-[4/3] overflow-hidden rounded-md bg-muted">
          {reel.posterUrl && <Image src={reel.posterUrl} alt="" width={92} height={138} unoptimized crossOrigin="anonymous" className="size-full scale-125 object-cover blur-[6px]" />}
          <BadgeQuestionMarkIcon className="absolute inset-0 m-auto size-10 text-white drop-shadow-[0_2px_6px_rgb(0_0_0/0.5)]" strokeWidth={2.25} />
        </span>
        <span className="mt-2 block font-display text-sm leading-tight font-bold">{tr("title")}</span>
        <span className="mt-1.5 flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={cn("flex size-4 items-center justify-center rounded-full", i < 2 ? "bg-muted-foreground/25 text-muted-foreground" : "ring-1 ring-border")}>
              {i < 2 && <XIcon className="size-2.5" strokeWidth={3} />}
            </span>
          ))}
        </span>
      </Reveal>
    </div>
  );
}

/** The heads-up slip a title shows: your topics, what people answered, never by colour alone. */
async function WarningsArt() {
  const t = await getTranslations("Home");
  const tw = await getTranslations("Warnings");
  const rows: [string, "yes" | "no", number, number][] = [
    [t("warnDog"), "no", 3, 214],
    [t("warnJump"), "yes", 168, 12],
    [t("warnSpiders"), "no", 1, 97],
  ];
  return (
    <Reveal className="rise relative mx-auto max-w-sm -rotate-[1deg] rounded-2xl bg-card p-4 pt-5 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_14px_32px_-14px_rgb(0_0_0/0.35)] ring-1 ring-border">
      <Tape className="rotate-2" />
      <p className="flex items-center gap-2 font-display text-lg font-extrabold">
        <TriangleAlertIcon className="size-5 text-brand" strokeWidth={2.5} />
        {tw("headsUp")}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map(([topic, verdict, yes, no], i) => (
          <li
            key={topic}
            className={cn("grow-pop flex items-center gap-3 rounded-xl p-2.5", verdict === "yes" ? "bg-brand-soft dark:bg-brand/20" : "bg-muted/60")}
            style={{ ["--grow-delay" as string]: `${150 + i * 110}ms` }}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{topic}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{tw("votes", { yes, no })}</span>
            </span>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                verdict === "yes" ? "bg-brand text-brand-foreground" : "bg-background text-foreground ring-1 ring-border",
              )}
            >
              {verdict === "yes" ? <TriangleAlertIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
              {tw("verdict", { verdict })}
            </span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/** The last page: Mystonie on a home screen, and the button that puts it on theirs (ADR 0088). */
async function InstallPage() {
  const t = await getTranslations("Home");
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-brand-soft px-6 pt-10 pb-8 dark:bg-brand/15">
      <div className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-[2.125rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance sm:text-[2.5rem]">{t.rich("installTitle", { mark })}</h2>
          <p className="max-w-[36ch] text-base text-pretty text-foreground/75">{t("installBody")}</p>
          <InstallButton label={t("installButton")} />
        </div>
        <Reveal aria-hidden="true" className="deal mx-auto grid w-48 grid-cols-3 gap-3 rounded-[1.75rem] bg-background/70 p-4 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45)] ring-1 ring-border sm:w-44">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="aspect-square rounded-[22%] bg-foreground/10" />
          ))}
          <span className="relative flex flex-col items-center gap-1">
            <Image src="/icon.svg" alt="" width={48} height={48} unoptimized className="aspect-square w-full rounded-[22%] bg-card shadow-md ring-2 ring-brand" />
          </span>
          <span className="aspect-square rounded-[22%] bg-foreground/10" />
        </Reveal>
      </div>
    </section>
  );
}
