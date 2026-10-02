"use client";

import { CheckIcon, DownloadIcon, PartyPopperIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { gettingStarted, type GettingStarted, type GettingStartedFacts, type GettingStartedStep } from "@/core/getting-started";
import { Link, usePathname } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { askToInstall, installPromptReady, isStandalone, markInstalled, subscribeInstall, wasInstalled } from "./pwa/browser";
import { installAskComing } from "./pwa/install-sheet";
import { Sheet } from "./sheet";
import { Reveal } from "@/components/motion/reveal";

// On this device (best effort): "Skip for now", the celebration seen and the welcome done. Installing is kept by
// ./pwa/browser (`wasInstalled`).
const SKIPPED = "mystonie.gettingStarted.skipped";
const CELEBRATED = "mystonie.gettingStarted.celebrated";
const WELCOMED = "mystonie.gettingStarted.welcomed";

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function write(key: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // storage blocked: the choice lasts until the page reloads
  }
  listeners.forEach((l) => l());
}

const never = () => () => {};
/** The pre-paint hint (`<html data-auth>`, src/core/auth.ts): only signed-in pages ask for the counts. */
const signedIn = () => document.documentElement.hasAttribute("data-auth");

/** Settings: "Show the getting-started checklist" brings the button back after "Skip for now" or the celebration. */
export function ShowGettingStarted() {
  const t = useTranslations("GettingStarted");
  const hidden = useSyncExternalStore(subscribe, () => read(SKIPPED) || read(CELEBRATED), () => false);
  return hidden ? (
    <button
      type="button"
      onClick={() => {
        write(SKIPPED, false);
        write(CELEBRATED, false);
      }}
      className="inline-flex h-11 items-center rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press"
    >
      {t("show")}
    </button>
  ) : (
    <p className="text-sm text-muted-foreground">{t("shown")}</p>
  );
}

const HREF: Record<Exclude<GettingStartedStep, "install">, string | { pathname: string; query: Record<string, string> }> = {
  add: { pathname: "/collection", query: { add: "1" } },
  card: "/collection",
  topics: "/settings/warnings",
  social: "/people",
};

// Pages with a bar of their own at the bottom, where the button would sit on it.
const HIDDEN_ON = ["/import"];

/**
 * The getting-started checklist (stage 4, ADR 0046, ADR 0056): a round progress button floating over the bottom right
 * of every signed-in page, just above the nav island. Tapping it opens the checklist in a sheet: five steps ticked from
 * real data (the server's counts, asked again on each page; installing is seen here, in the browser, and its step is a
 * button that installs, ADR 0088), "Skip for now"
 * (Settings brings it back) and a small celebration at 100 %, once. A new account's first page opens it by itself,
 * once on each device (the owner, 2026-10-02; ADR 0072).
 */
export function GettingStartedButton() {
  const t = useTranslations("GettingStarted");
  const pathname = usePathname();
  const auth = useSyncExternalStore(never, signedIn, () => false);
  // Hidden until the browser says otherwise, so a skipped checklist never flashes.
  const skipped = useSyncExternalStore(subscribe, () => read(SKIPPED), () => true);
  const celebrated = useSyncExternalStore(subscribe, () => read(CELEBRATED), () => true);
  const standalone = useSyncExternalStore(subscribe, isStandalone, () => false);
  const installed = useSyncExternalStore(subscribeInstall, wasInstalled, () => false) || standalone;
  const [facts, setFacts] = useState<Omit<GettingStartedFacts, "installed"> | null>(null);
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (standalone && !wasInstalled()) markInstalled();
  }, [standalone]);

  // The counts, again on every page (and each time the sheet opens) while the checklist is still in use.
  const active = auth && !skipped && !celebrated;
  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    fetch("/api/getting-started", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ facts: Omit<GettingStartedFacts, "installed"> }>) : null))
      .then((body) => {
        if (!body) return;
        setFacts(body.facts);
        // The welcome: an account that has done nothing yet sees the checklist open on its first page. Not over
        // another sheet (it waits for a later page), and once per device; an account under way never gets it.
        if (hidden || read(WELCOMED)) return;
        const f = body.facts;
        const fresh = f.entries + f.cards + f.avoidTopics + f.following + f.clubs === 0;
        // Installing comes first (ADR 0088): while the install sheet is about to ask, the welcome waits too.
        if (fresh && (document.querySelector("dialog[open]") || installAskComing(pathname))) return;
        write(WELCOMED, true);
        if (!fresh) return;
        setOpen(true);
        track("getting_started", { action: "welcomed" });
      })
      .catch(() => {}); // offline or a hiccup: keep what it showed
    return () => controller.abort();
  }, [active, pathname, asked, hidden]);

  if (!active || !facts) return null;
  const g = gettingStarted({ ...facts, installed });
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        data-getting-started
        onClick={() => {
          setOpen(true);
          setAsked((n) => n + 1);
          track("getting_started", { action: "opened" });
        }}
        aria-label={g.complete ? t("doneTitle") : t("open", { done: g.done, total: g.total })}
        className={cn(
          "fixed right-4 bottom-[calc(var(--island-space)+0.25rem)] z-30 flex size-14 items-center justify-center rounded-full bg-card/90 shadow-[0_1px_3px_rgb(0_0_0/0.06),0_10px_24px_-10px_rgb(0_0_0/0.45)] ring-1 ring-border backdrop-blur-xl transition-transform outline-none hover:ring-brand/50 focus-visible:ring-2 focus-visible:ring-ring active:scale-90 sm:right-6 print:hidden dark:bg-muted/90 dark:ring-foreground/15",
          hidden && "hidden",
        )}
      >
        <Ring percent={g.percent} />
        {g.complete ? (
          <PartyPopperIcon aria-hidden="true" className="size-6 animate-bounce text-brand motion-reduce:animate-none" />
        ) : (
          <span aria-hidden="true" className="font-display text-sm leading-none font-extrabold tabular-nums">
            {g.done}
            <span className="text-muted-foreground">/{g.total}</span>
          </span>
        )}
      </button>
      <Sheet open={open} onClose={close} title={g.complete ? t("doneTitle") : t("title")} closeLabel={t("close")}>
        {g.complete ? (
          <Celebration
            g={g}
            onDone={() => {
              track("getting_started", { action: "completed" });
              close();
              write(CELEBRATED, true);
            }}
          />
        ) : (
          <Checklist
            g={g}
            onNavigate={close}
            onInstall={() => {
              // The browser's own dialog opens over the checklist, which then ticks; the steps get a sheet of their own.
              if (!installPromptReady()) close();
              askToInstall();
            }}
            onSkip={() => {
              track("getting_started", { action: "skipped" });
              close();
              write(SKIPPED, true);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

/** The button's progress: a coral arc around it, drawn as far as the steps done. */
function Ring({ percent }: { percent: number }) {
  const r = 25;
  const length = 2 * Math.PI * r;
  return (
    <Reveal className="absolute inset-0">
    <svg aria-hidden="true" viewBox="0 0 56 56" className="size-full -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" className="stroke-muted dark:stroke-foreground/10" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - percent / 100)}
        className="grow-ring stroke-brand transition-[stroke-dashoffset] duration-500"
        style={{ ["--ring-length" as string]: length }}
      />
    </svg>
    </Reveal>
  );
}

function Bar({ g }: { g: GettingStarted }) {
  const t = useTranslations("GettingStarted");
  return (
    <Reveal
      role="progressbar"
      aria-label={t("progressLabel")}
      aria-valuemin={0}
      aria-valuemax={g.total}
      aria-valuenow={g.done}
      aria-valuetext={t("progress", { done: g.done, total: g.total })}
      className="h-3 overflow-hidden rounded-full bg-muted ring-1 ring-border"
    >
      <div className="grow-w h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${g.percent}%` }} />
    </Reveal>
  );
}

function Checklist({ g, onNavigate, onInstall, onSkip }: { g: GettingStarted; onNavigate: () => void; onInstall: () => void; onSkip: () => void }) {
  const t = useTranslations("GettingStarted");
  return (
    <div className="flex flex-col gap-3">
      <p className="font-hand text-xl leading-none text-muted-foreground tabular-nums">{t("progress", { done: g.done, total: g.total })}</p>
      <Bar g={g} />
      <ol className="flex flex-col">
        {g.steps.map(({ step, done }) => {
          const label = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full ring-2",
                  done ? "bg-brand text-brand-foreground ring-brand" : "ring-border",
                )}
              >
                {done && <CheckIcon className="size-4" strokeWidth={3} />}
              </span>
              <span className="flex flex-col">
                <span className={cn("font-medium", done && "text-muted-foreground line-through")}>{t(`steps.${step}`)}</span>
                {!done && <span className="text-xs text-muted-foreground">{t(`hints.${step}`)}</span>}
              </span>
              <span className="sr-only">{done ? t("done") : t("toDo")}</span>
            </>
          );
          return (
            <li key={step}>
              {done ? (
                <div className="flex min-h-12 items-center gap-3 py-1.5">{label}</div>
              ) : step === "install" ? (
                <button
                  type="button"
                  data-install-step
                  onClick={onInstall}
                  className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                >
                  {label}
                  <span
                    aria-hidden="true"
                    className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 text-sm font-semibold text-brand-foreground shadow-sm press"
                  >
                    <DownloadIcon className="size-4" strokeWidth={2.5} />
                    {t("installButton")}
                  </span>
                </button>
              ) : (
                <Link href={HREF[step]} onClick={onNavigate} className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={onSkip}
        className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline"
      >
        {t("skip")}
      </button>
    </div>
  );
}

function Celebration({ g, onDone }: { g: GettingStarted; onDone: () => void }) {
  const t = useTranslations("GettingStarted");
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <PartyPopperIcon aria-hidden="true" className="size-10 animate-bounce text-brand motion-reduce:animate-none" />
      <p className="text-sm text-muted-foreground">{t("doneBody")}</p>
      <div className="w-full">
        <Bar g={g} />
      </div>
      <button type="button" onClick={onDone} className="h-11 rounded-full bg-brand px-5 font-semibold text-brand-foreground hover:bg-brand/90 press">
        {t("doneButton")}
      </button>
    </div>
  );
}
