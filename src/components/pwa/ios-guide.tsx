"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookmarkIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EllipsisIcon,
  PointerIcon,
  ShareIcon,
  SmartphoneIcon,
  SquarePlusIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type { IosGuide } from "@/core/install";
import { cn } from "@/lib/utils";

/** How long each picture of the guide stays before the next (with motion allowed). */
const SCENE_MS = 2400;
/** Tap Share, Add to Home Screen, Open as Web App, then Mystonie on the home screen. */
const SCENES = 4;

/**
 * The iPhone's install steps as a little phone that plays them (ADR 0088): the browser's Share button (where this
 * browser has it), the Share sheet's "Add to Home Screen", the "Open as Web App" switch and Add, then the icon on the
 * home screen. The step being shown is lit in the list; tapping a step shows its picture. Still under reduced motion.
 */
export function IosSteps({ guide }: { guide: IosGuide }) {
  const t = useTranslations("Install");
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const timer = setInterval(() => setScene((s) => (s + 1) % SCENES), SCENE_MS);
    return () => clearInterval(timer);
  }, [playing]);

  const share = guide.menuFirst ? t("iosShareMenu") : guide.spot === "top-right" ? t("iosShareTop") : t("iosShareBottom");
  const steps: [ReactNode, string][] = [
    [guide.menuFirst ? <EllipsisIcon key="i" /> : <ShareIcon key="i" />, share],
    [<SquarePlusIcon key="i" />, t("iosAdd")],
    [<SmartphoneIcon key="i" />, t("iosWebApp")],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Phone scene={scene} guide={guide} />
      <ol className="flex flex-col gap-2">
        {steps.map(([icon, text], i) => (
          <li key={i}>
            <button
              type="button"
              aria-current={scene === i ? "step" : undefined}
              onClick={() => {
                setPlaying(false);
                setScene(i);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-medium transition-colors [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-brand",
                scene === i ? "bg-brand-soft ring-2 ring-brand dark:bg-brand/20" : "bg-muted/60",
              )}
            >
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
                {icon}
              </span>
              {text}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** What it's pointing at: a ring that pulses and a finger that taps. */
function Tap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <span className="relative z-10 inline-flex rounded-full ring-2 ring-brand motion-safe:animate-pulse">{children}</span>
      <PointerIcon aria-hidden="true" className="absolute top-3/4 left-1/2 z-20 size-5 fill-background text-foreground motion-safe:animate-bounce" />
    </span>
  );
}

function Phone({ scene, guide }: { scene: number; guide: IosGuide }) {
  const t = useTranslations("Install");
  const host = typeof window === "undefined" ? "" : window.location.host;
  const shareIcon = guide.menuFirst ? <EllipsisIcon className="size-3.5" /> : <ShareIcon className="size-3.5" />;

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[216px] w-[176px] overflow-hidden rounded-[30px] bg-background text-[9px] leading-tight shadow-lg ring-[5px] ring-foreground/85"
    >
      {/* The page behind: our header and a few lines. */}
      <div className={cn("flex flex-col gap-1.5 px-3", guide.spot === "top-right" ? "pt-9" : "pt-4")}>
        <span className="flex items-center gap-1 font-display text-[11px] font-extrabold">
          <Image src="/icon.svg" alt="" width={14} height={14} unoptimized className="size-3.5 rounded-full" />
          {t("appName")}
        </span>
        {[90, 75, 82, 60, 70].map((w) => (
          <span key={w} className="h-1.5 rounded-full bg-muted" style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* 1: the browser's bar, with Share (or its menu) lit. */}
      {guide.spot === "top-right" ? (
        <div className="absolute inset-x-2 top-2 flex items-center gap-1">
          <span className="flex h-5 flex-1 items-center justify-center truncate rounded-full bg-muted px-2 text-muted-foreground">{host}</span>
          {scene === 0 ? <Tap>{<span className="flex size-5 items-center justify-center">{shareIcon}</span>}</Tap> : <span className="flex size-5 items-center justify-center">{shareIcon}</span>}
        </div>
      ) : guide.spot === "bottom-right" ? (
        <div className="absolute inset-x-2 bottom-2 flex items-center gap-1 rounded-full bg-card p-1 shadow-md ring-1 ring-border">
          <ChevronLeftIcon className="size-3.5 shrink-0" />
          <span className="flex h-5 flex-1 items-center justify-center truncate rounded-full bg-muted px-1.5 text-muted-foreground">{host}</span>
          {scene === 0 ? <Tap><span className="flex size-5 items-center justify-center">{shareIcon}</span></Tap> : <span className="flex size-5 items-center justify-center">{shareIcon}</span>}
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 border-t border-border bg-card px-2 pt-1 pb-2">
          <span className="mx-auto flex h-4 w-4/5 items-center justify-center truncate rounded-full bg-muted text-muted-foreground">{host}</span>
          <span className="flex items-center justify-between px-1">
            <ChevronLeftIcon className="size-3.5" />
            <ChevronRightIcon className="size-3.5 opacity-40" />
            {scene === 0 ? <Tap><span className="flex size-5 items-center justify-center">{shareIcon}</span></Tap> : <span className="flex size-5 items-center justify-center">{shareIcon}</span>}
            <BookOpenIcon className="size-3.5" />
            <CopyIcon className="size-3.5" />
          </span>
        </div>
      )}

      {/* 2: the Share sheet, "Add to Home Screen" lit. */}
      <Slide shown={scene === 1}>
        <p className="pb-1 text-center font-semibold">{t("art.share")}</p>
        <Row icon={<CopyIcon />}>{t("art.copy")}</Row>
        <Row icon={<BookmarkIcon />}>{t("art.bookmark")}</Row>
        <Row icon={<SquarePlusIcon />} lit>
          {t("art.home")}
        </Row>
      </Slide>

      {/* 3: Add to Home Screen: our icon, "Open as Web App" on, Add lit. */}
      <Slide shown={scene === 2}>
        <span className="flex items-center justify-between pb-1.5">
          <span className="text-brand">{t("art.cancel")}</span>
          <Tap>
            <span className="px-1.5 py-0.5 font-bold text-brand">{t("art.add")}</span>
          </Tap>
        </span>
        <span className="flex items-center gap-2 rounded-lg bg-muted/70 p-1.5">
          <Image src="/icon.svg" alt="" width={24} height={24} unoptimized className="size-6 rounded-md" />
          <span className="font-semibold">{t("appName")}</span>
        </span>
        <span className="mt-1.5 flex items-center justify-between rounded-lg bg-muted/70 p-1.5">
          {t("art.webApp")}
          <span className="flex h-3.5 w-6 items-center justify-end rounded-full bg-[#34c759] p-0.5">
            <span className="size-2.5 rounded-full bg-white" />
          </span>
        </span>
      </Slide>

      {/* 4: there it is, on the home screen. */}
      <div
        className={cn(
          "absolute inset-0 grid grid-cols-3 content-center gap-3 bg-brand-soft p-4 transition-opacity duration-300 dark:bg-[#2a1a12]",
          scene === 3 ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="mx-auto size-9 rounded-[10px] bg-foreground/10" />
        ))}
        <span className="flex flex-col items-center gap-0.5">
          <Image
            src="/icon.svg"
            alt=""
            width={36}
            height={36}
            unoptimized
            className={cn("size-9 rounded-[10px] shadow-md ring-2 ring-brand", scene === 3 && "motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500")}
          />
          <span className="text-[8px] font-semibold">{t("appName")}</span>
        </span>
      </div>
    </div>
  );
}

function Slide({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-t-2xl bg-card p-2.5 pb-4 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.4)] ring-1 ring-border transition-transform duration-300",
        shown ? "translate-y-0" : "translate-y-full",
      )}
    >
      {children}
    </div>
  );
}

function Row({ icon, lit, children }: { icon: ReactNode; lit?: boolean; children: ReactNode }) {
  const row = (
    <span className={cn("flex w-full items-center justify-between rounded-lg bg-muted/70 px-2 py-1.5 [&_svg]:size-3.5", lit && "bg-brand-soft font-semibold text-brand dark:bg-brand/25")}>
      {children}
      {icon}
    </span>
  );
  return lit ? <Tap className="w-full">{row}</Tap> : row;
}

/**
 * "Show me where to tap": the sheet steps aside and an arrow points at the browser's own Share button (or its menu),
 * with the rest of the steps under it, until they close it (ADR 0088).
 */
export function IosCoach({ guide, onClose }: { guide: IosGuide; onClose: () => void }) {
  const t = useTranslations("Install");
  const top = guide.spot === "top-right";
  const text = guide.menuFirst ? (top ? t("coachMenuTop") : t("coachMenu")) : top ? t("coachTop") : t("coachBottom");
  const Arrow = top ? ArrowUpIcon : ArrowDownIcon;
  const arrow = (
    <Arrow
      aria-hidden="true"
      strokeWidth={3}
      className={cn(
        "size-12 text-brand drop-shadow-[0_2px_6px_rgb(0_0_0/0.35)] motion-safe:animate-bounce",
        guide.spot === "bottom-center" ? "self-center" : "mr-2 self-end",
      )}
    />
  );

  return (
    <div
      role="dialog"
      aria-label={t("guideLabel")}
      data-install-coach
      className={cn(
        "pointer-events-none fixed inset-x-0 z-50 flex flex-col gap-2 px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 print:hidden",
        top ? "top-[max(0.5rem,env(safe-area-inset-top))]" : "bottom-[max(0.5rem,env(safe-area-inset-bottom))]",
      )}
    >
      {top && arrow}
      <div className="pointer-events-auto relative mx-auto w-full max-w-sm rounded-2xl bg-card p-4 pr-12 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.5)] ring-2 ring-brand">
        <p className="font-display text-lg leading-snug font-extrabold">{text}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("coachThen")}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("coachClose")}
          className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
      {!top && arrow}
    </div>
  );
}
