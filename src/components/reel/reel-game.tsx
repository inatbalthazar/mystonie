"use client";

import { CheckIcon, LockIcon, Share2Icon, SparklesIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { BadgeToast } from "@/components/badges/badge-toast";
import { Celebration } from "@/components/celebration";
import { StonieHop } from "@/components/motion/stonie-hop";
import { PaperCard } from "@/components/paper-card";
import { MIN_SEARCH_CHARS, useTitleSearch } from "@/components/title-search";
import type { BadgeNews } from "@/core/badges";
import type { CardData, CardReel } from "@/core/cards/types";
import type { SearchResult } from "@/core/catalog/types";
import { formatRuntime } from "@/core/format/runtime";
import { REEL_CLUES, REEL_GUESSES, reelCard, reelShareText, type ReelGuess, type ReelState, type ReelStats } from "@/core/reel";
import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// A guest's guesses live in this browser only (signed-in plays live on the server).
const STORAGE_KEY = "mystonie.reel";
/** Blur (px) at each poster step: heavy at first, gone once the play is over. */
const BLUR = [26, 18, 12, 8, 5, 2.5, 0];

type Response = { state: ReelState; card: CardReel | null; stats: ReelStats | null; badges?: BadgeNews[] };

function readLocal(day: string): ReelGuess[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { day?: string; guesses?: ReelGuess[] } | null;
    return saved?.day === day && Array.isArray(saved.guesses) ? saved.guesses : [];
  } catch {
    return [];
  }
}

function writeLocal(day: string, guesses: readonly ReelGuess[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ day, guesses }));
  } catch {
    // private mode: the play still works, it just isn't remembered
  }
}

/** Milliseconds until the next UTC midnight: the next reel. */
const untilNext = (now: number) => 86_400_000 - (now % 86_400_000);

/**
 * Reel of the Day (stage 4 daily game): the blurred poster, the clues, the guesses and a search to guess from. The
 * server grades every guess (`POST /api/reel`); guests keep theirs in this browser and send them all each time.
 */
export function ReelGame({
  day,
  number,
  signedIn,
  username,
  host,
}: {
  day: string;
  number: number;
  signedIn: boolean;
  username: string | null;
  host: string;
}) {
  const t = useTranslations("Reel");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Response | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "guessError">("loading");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [celebrate, setCelebrate] = useState<CardData | null>(null);
  // Reel stickers the play that just ended earned (ADR 0063).
  const [stickers, setStickers] = useState<BadgeNews[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const finishedHere = useRef(false);
  const search = useTitleSearch(query, "screen");

  async function send(guesses: readonly ReelGuess[]): Promise<boolean> {
    const res = await fetch("/api/reel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, guesses }),
    }).catch(() => null);
    if (res?.status === 409) {
      // Midnight UTC passed: the page reloads with the new reel.
      setNotice(t("newDay"));
      router.refresh();
      return false;
    }
    if (!res?.ok) return false;
    const body = (await res.json()) as Response;
    if (body.badges?.length) setStickers(body.badges);
    setData((before) => {
      if (before && !before.state.done && body.state.done && !finishedHere.current) {
        finishedHere.current = true;
        track("reel_finished", { solved: body.state.solved, guesses: body.state.guesses.length });
      }
      return body;
    });
    if (!signedIn) writeLocal(day, body.state.guesses);
    setNow(Date.now());
    return true;
  }

  /** The play so far: the server's for a signed-in player, this browser's guesses for a guest. */
  const fetchPlay = async () => setStatus((await send(signedIn ? [] : readLocal(day))) ? "ready" : "error");

  function retry() {
    setStatus("loading");
    void fetchPlay();
  }

  useEffect(() => {
    // After a tick, so the first render (loading) settles before the request's results arrive.
    const timer = setTimeout(fetchPlay, 0);
    return () => clearTimeout(timer);
    // Once per day: `fetchPlay` changes every render, the day doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // The countdown to the next reel, once the play is over.
  const done = data?.state.done ?? false;
  useEffect(() => {
    if (!done) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [done]);

  async function guess(result: SearchResult) {
    if (!data || busy) return;
    setBusy(true);
    const guesses = [
      ...data.state.guesses.map(({ externalId, name }) => ({ externalId, name })),
      { externalId: result.externalId, name: result.name },
    ];
    const ok = await send(guesses);
    setStatus(ok ? "ready" : "guessError");
    if (ok) setQuery("");
    setBusy(false);
  }

  if (!data) {
    return (
      <PaperCard className="flex flex-col items-start gap-3">
        <p aria-live="polite" className="flex items-center gap-3 text-muted-foreground">
          {status !== "error" && <StonieHop size={28} />}
          {status === "error" ? t("loadError") : t("loading")}
        </p>
        {status === "error" && (
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-semibold text-brand-foreground hover:bg-brand/90"
          >
            {t("retry")}
          </button>
        )}
      </PaperCard>
    );
  }

  const { state, stats } = data;
  const left = REEL_GUESSES - state.guesses.length;
  const guessed = new Set(state.guesses.map((g) => g.externalId));
  const movies = search.status === "done" ? search.results.filter((r) => r.kind === "movie").slice(0, 6) : [];
  // Guests share their squares without a streak (they have none on the server).
  const card = data.card ?? (state.done ? { ...reelCard(state, 0)!, streak: 0 } : null);

  async function share() {
    if (!card) return;
    const text = reelShareText(card, `https://${host}/reel`, t("title"));
    try {
      if (navigator.share) {
        await navigator.share({ text });
        track("reel_shared", { channel: "share_sheet" });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setNotice(t("copied"));
      track("reel_shared", { channel: "copy" });
    } catch {
      // no clipboard: nothing more to try
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PaperCard className="flex flex-col gap-5 sm:flex-row">
        {/* The poster: served small and blurred while the play runs, sharper with every miss. */}
        <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border sm:mx-0">
          <Image
            key={state.posterStep}
            src={`/api/reel/poster?day=${state.day}&step=${state.posterStep}`}
            alt={state.answer ? t("answerPosterAlt", { name: state.answer.name }) : t("posterAlt")}
            fill
            unoptimized
            sizes="160px"
            className="scale-110 object-cover transition-[filter] duration-700"
            style={{ filter: `blur(${BLUR[state.posterStep] ?? 0}px)` }}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">{t("clues")}</h2>
          <dl className="flex flex-col gap-1.5">
            {REEL_CLUES.map((key, i) => {
              const open = key in state.clues;
              const value = state.clues[key];
              return (
                <div key={key} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1.5 last:border-0">
                  <dt className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">
                    {t("clue", { key })}
                  </dt>
                  <dd className={cn("min-w-0 text-right text-sm", open ? "font-semibold" : "text-muted-foreground")}>
                    {open ? (
                      value === null || value === undefined ? (
                        t("clueUnknown")
                      ) : typeof value === "number" ? (
                        String(value)
                      ) : (
                        value
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <LockIcon className="size-3.5" aria-hidden="true" />
                        {t("clueLocked", { count: i + 1 })}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </PaperCard>

      <section aria-labelledby="reel-guesses" className="flex flex-col gap-3">
        <h2 id="reel-guesses" className="sr-only">
          {t("guesses")}
        </h2>
        <ol className="grid grid-cols-6 gap-1.5" aria-hidden="true">
          {Array.from({ length: REEL_GUESSES }, (_, i) => state.guesses[i]).map((g, i) => (
            <li key={i} className={cn("h-3 rounded-full", !g ? "bg-muted" : g.correct ? "bg-chart-2" : "bg-destructive/80")} />
          ))}
        </ol>
        {state.guesses.length > 0 && (
          <ol className="flex flex-col gap-1.5">
            {state.guesses.map((g) => (
              <li key={g.externalId} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-border">
                {g.correct ? (
                  <CheckIcon className="size-4 shrink-0 text-chart-2" aria-hidden="true" />
                ) : (
                  <XIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate font-semibold">{g.name}</span>
                <span className="shrink-0 text-muted-foreground">{g.correct ? t("right") : t("wrong")}</span>
              </li>
            ))}
          </ol>
        )}

        {!state.done && (
          <div className="flex flex-col gap-2">
            <label htmlFor="reel-search" className="flex items-baseline justify-between gap-2 font-semibold">
              {t("guessLabel")}
              <span className="text-sm font-normal text-muted-foreground">{t("guessesLeft", { count: left })}</span>
            </label>
            <input
              id="reel-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("guessPlaceholder")}
              autoComplete="off"
              disabled={busy}
              className="h-12 rounded-xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {status === "guessError" && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {t("guessError")}
              </p>
            )}
            {query.trim().length >= MIN_SEARCH_CHARS && movies.length > 0 && (
              <ul className="flex flex-col gap-1">
                {movies.map((m) => (
                  <li key={m.externalId}>
                    <button
                      type="button"
                      onClick={() => guess(m)}
                      disabled={busy || guessed.has(m.externalId)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-muted disabled:opacity-50"
                    >
                      <span className="min-w-0 truncate font-semibold">{m.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">{guessed.has(m.externalId) ? t("alreadyGuessed") : m.year}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {state.done && state.answer && (
        <PaperCard stamp={state.solved ? `${state.guesses.length}/${REEL_GUESSES}` : `X/${REEL_GUESSES}`} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">
              {state.solved ? t("solvedTitle", { count: state.guesses.length }) : t("lostTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("answerWas")}
              {": "}
              <Link href={`/title/movie/${state.answer.externalId}`} className="font-semibold text-brand hover:underline">
                {state.answer.name}
                {state.answer.year ? ` (${state.answer.year})` : ""}
              </Link>
            </p>
            {now !== null && (
              <p className="text-sm text-muted-foreground">{t("nextReel", { time: formatRuntime(untilNext(now) / 60_000, locale) })}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={share}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
            >
              <Share2Icon className="size-4" aria-hidden="true" />
              {t("shareResult")}
            </button>
            {signedIn && data.card && (
              <button
                type="button"
                onClick={() => setCelebrate({ kind: "movie", name: `${t("title")} #${number}`, finishedOn: day, posterUrl: null, reel: data.card })}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-card px-5 font-semibold shadow-sm ring-1 ring-border hover:bg-muted"
              >
                <SparklesIcon className="size-4" aria-hidden="true" />
                {t("makeCard")}
              </button>
            )}
          </div>
          <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
            {notice}
          </p>
          {!signedIn && (
            <p className="text-sm">
              {t("guestNote")}{" "}
              <Link href={{ pathname: "/auth", query: { next: "/reel" } }} className="font-semibold text-brand hover:underline">
                {t("signIn")}
              </Link>
            </p>
          )}
        </PaperCard>
      )}

      {stats && (
        <PaperCard className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">{t("stats")}</h2>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              [t("played"), format.number(stats.played)],
              [t("winRate"), format.number(stats.played ? Math.round((stats.won / stats.played) * 100) : 0)],
              [t("streak"), format.number(stats.streak)],
              [t("maxStreak"), format.number(stats.maxStreak)],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dd className="order-1 font-display text-3xl font-extrabold">{value}</dd>
                <dt className="order-2 text-[11px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">
                  {label}
                </dt>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">{t("distribution")}</h3>
            {stats.distribution.map((count, i) => (
              <div key={i} className="flex items-center gap-2 text-sm tabular-nums">
                <span className="w-3 shrink-0 text-muted-foreground">{i + 1}</span>
                <span
                  className={cn(
                    "flex h-5 min-w-6 items-center justify-end rounded px-1.5 text-xs font-bold",
                    state.solved && state.guesses.length === i + 1 ? "bg-chart-2 text-white" : "bg-muted",
                  )}
                  style={{ width: `${Math.max(8, (count / Math.max(1, ...stats.distribution)) * 100)}%` }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </PaperCard>
      )}

      {celebrate ? (
        <Celebration
          data={celebrate}
          source={{ kind: "reel", ready: true }}
          animate
          username={username}
          host={host}
          onClose={() => setCelebrate(null)}
        />
      ) : (
        stickers.length > 0 && <BadgeToast key={stickers.map((b) => b.id).join()} badges={stickers} onClose={() => setStickers([])} />
      )}
    </div>
  );
}
