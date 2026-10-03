"use client";

import { FlameIcon, GavelIcon, HandHeartIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeToast } from "@/components/badges/badge-toast";
import { Sticker } from "@/components/badges/sticker";
import { Stonie } from "@/components/stonie";
import type { BadgeNews } from "@/core/badges";
import { QUIZ_ANSWERS_TO_RESOLVE, QUIZ_MIN_ANSWER_MS, type QuizChoice, type QuizQuestion, type QuizResult, type QuizServe } from "@/core/quiz";
import { nextQuizSticker, QUIZ_LADDER, QUIZ_ROUND, QUIZ_STREAK_DAYS, withHelp, type QuizStanding } from "@/core/quiz-standing";
import { SCENE_CONFIRMATIONS } from "@/core/scene-warnings";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { usePlaceLabel, useTopicName } from "./scene-place";

type State = { kind: "loading" } | { kind: "error" } | { kind: "served"; serve: QuizServe } | { kind: "round" };
type Note = { tone: "good" | "warn" | "win"; text: string } | null;
/**
 * What this round did: questions answered (not too fast), answers that helped, questions settled, warnings confirmed,
 * and the most people avoiding one of its topics that an answer helped (ADR 0094).
 */
type Round = { asked: number; helped: number; settled: number; confirmed: number; reach: number };
const NEW_ROUND: Round = { asked: 0, helped: 0, settled: 0, confirmed: 0, reach: 0 };

/** How long the answer's stamp stays on the card before the next one is dealt (none with reduced motion). */
const STAMP_MS = 650;
const moving = () => window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * The warnings quiz (S3 warnings & quiz, ADR 0094): rounds of five questions about titles the user finished, from GET
 * /api/quiz, answered with POST /api/quiz. Above them, the helper's log: answers, final says and the day streak, with
 * the ladder of answer stickers and the next one's progress. Each answer stamps the card before the next is dealt;
 * each round ends with what it did. The server times every answer; the buttons wake up only after a question has been
 * on screen long enough to read (the same 1.5 s the server requires), so honest answers always count. No Gems: the
 * rewards are stickers (ADR 0063, ADR 0094), and the point is helping others skip what they'd rather not see.
 */
export function WarningsQuiz({ titleId, standing: initial }: { titleId: string | null; standing: QuizStanding }) {
  const t = useTranslations("Quiz");
  const format = useFormatter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [note, setNote] = useState<Note>(null);
  const [standing, setStanding] = useState(initial);
  const [round, setRound] = useState<Round>(NEW_ROUND);
  const [sending, setSending] = useState(false);
  const [stickers, setStickers] = useState<BadgeNews[]>([]);

  const request = useCallback(async (): Promise<State> => {
    try {
      const res = await fetch(`/api/quiz${titleId ? `?title=${titleId}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      return { kind: "served", serve: (await res.json()) as QuizServe };
    } catch {
      return { kind: "error" };
    }
  }, [titleId]);
  const next = async () => setState(await request());

  // The first question, once the page is on screen.
  useEffect(() => {
    let live = true;
    request().then((first) => live && setState(first));
    return () => {
      live = false;
    };
  }, [request]);

  async function answer(question: QuizQuestion, choice: QuizChoice) {
    setSending(true);
    try {
      const stamped = moving() ? pause(STAMP_MS) : Promise.resolve();
      const res = await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: question.id, choice }) });
      if (!res.ok) throw new Error(String(res.status));
      const result = (await res.json()) as QuizResult & { badges?: BadgeNews[] };
      await stamped;
      if (result.badges?.length) setStickers(result.badges);
      if (result.status === "paused") {
        setNote(null);
        setState({ kind: "served", serve: { status: "paused", until: result.until } });
        return;
      }
      setNote(feedback(question, result));
      if (result.status !== "counted" && result.status !== "not_counted") {
        await next();
        return;
      }
      track("quiz_answered", { kind: question.kind, choice, counted: result.status === "counted" });
      // A counted answer that resolved a topic question was the one that settled it; one that confirmed a warning
      // that still needed confirmations confirmed it.
      const settled = result.status === "counted" && result.kind === "topic" && result.result !== "open";
      const confirmed = result.status === "counted" && result.kind === "warning" && result.result === "confirmed" && question.answers < SCENE_CONFIRMATIONS;
      const helped = choice !== "unsure";
      if (helped) setStanding((s) => withHelp(s, { warning: question.kind === "warning", settled }));
      const done = {
        asked: round.asked + 1, helped: round.helped + (helped ? 1 : 0), settled: round.settled + (settled ? 1 : 0), confirmed: round.confirmed + (confirmed ? 1 : 0),
        reach: helped ? Math.max(round.reach, question.avoiders) : round.reach,
      };
      setRound(done);
      if (done.asked >= QUIZ_ROUND) {
        setNote(null);
        setState({ kind: "round" });
        track("quiz_round", { helped: done.helped });
      } else {
        await next();
      }
    } catch {
      setState({ kind: "error" });
    } finally {
      setSending(false);
    }
  }

  function feedback(question: QuizQuestion, result: QuizResult): Note {
    if (result.status === "too_fast") return { tone: "warn", text: t("tooFast") };
    if (result.status !== "counted") return null;
    if (result.kind === "topic" && (result.result === "yes" || result.result === "no" || result.result === "contested")) {
      return { tone: "win", text: t("settled", { title: question.title.name, result: result.result }) };
    }
    if (result.kind === "warning" && result.result === "confirmed" && question.answers < SCENE_CONFIRMATIONS) return { tone: "win", text: t("confirmedNow") };
    return { tone: "good", text: t("thanks") };
  }

  function anotherRound() {
    setRound(NEW_ROUND);
    setState({ kind: "loading" });
    void next();
  }

  return (
    <div className="flex flex-col gap-6">
      <HelperLog standing={standing} />
      {state.kind === "loading" ? (
        <div aria-hidden="true" className="h-80 skeleton rounded-3xl" />
      ) : state.kind === "error" ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="font-medium text-destructive">
            {t("error")}
          </p>
          <button
            type="button"
            onClick={() => {
              setState({ kind: "loading" });
              void next();
            }}
            className="inline-flex h-11 items-center rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted press"
          >
            {t("retry")}
          </button>
        </div>
      ) : state.kind === "round" ? (
        <RoundDone round={round} standing={standing} onAgain={anotherRound} />
      ) : state.serve.status === "question" ? (
        <section aria-label={t("roundLabel")} className="flex flex-col gap-3">
          <RoundDots asked={round.asked} />
          <QuestionCard key={state.serve.id} question={state.serve} left={QUIZ_ROUND - round.asked - 1} sending={sending} onAnswer={(choice) => answer(state.serve as QuizQuestion, choice)} />
          <p
            role="status"
            className={cn(
              "flex min-h-6 items-center justify-center gap-1.5 text-center text-sm",
              note?.tone === "warn" ? "font-semibold text-destructive" : note?.tone === "win" ? "font-bold text-brand" : "text-muted-foreground",
            )}
          >
            {note?.tone === "win" && <GavelIcon aria-hidden="true" className="size-4 shrink-0" />}
            {note && <span key={note.text} className="motion-safe:animate-fade">{note.text}</span>}
          </p>
        </section>
      ) : state.serve.status === "paused" ? (
        <EmptyCard title={t("pausedTitle")} body={t("pausedBody", { time: format.dateTime(new Date(state.serve.until), { hour: "numeric", minute: "2-digit" }) })} />
      ) : state.serve.status === "no_finishes" ? (
        <EmptyCard title={t("noFinishesTitle")} body={t("noFinishesBody")} cta={{ href: "/collection", label: t("toCollection") }} />
      ) : (
        <EmptyCard title={t("doneTitle")} body={t("doneBody")} cta={{ href: "/home", label: t("back") }} />
      )}
      {stickers.length > 0 && <BadgeToast key={stickers.map((b) => b.id).join()} badges={stickers} onClose={() => setStickers([])} />}
    </div>
  );
}

/**
 * The helper's log: three numbers (answers, final says, days in a row), the ladder of answer stickers with the next
 * one's progress, and where the streak stands. Numbers pop when they change.
 */
function HelperLog({ standing }: { standing: QuizStanding }) {
  const t = useTranslations("Quiz");
  const badges = useTranslations("Badges");
  const goal = nextQuizSticker(standing.answers);
  const stats = [
    { key: "answers", value: standing.answers, label: t("statAnswers", { count: standing.answers }), icon: HandHeartIcon },
    { key: "settled", value: standing.settled, label: t("statSettled", { count: standing.settled }), icon: GavelIcon },
    { key: "streak", value: standing.streak, label: t("statStreak", { count: standing.streak }), icon: FlameIcon },
  ];
  return (
    <section aria-labelledby="helper-log" className="relative flex flex-col gap-4 rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border">
      <span aria-hidden="true" className="absolute -top-2.5 left-8 h-5 w-16 -rotate-3 rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      <h2 id="helper-log" className="font-hand text-2xl leading-none text-muted-foreground">
        {t("logTitle")}
      </h2>
      <dl className="grid grid-cols-3 gap-2">
        {stats.map(({ key, value, label, icon: Icon }) => (
          <div key={key} className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/50 px-1 py-2 text-center">
            <dt className="order-2 text-xs leading-tight text-muted-foreground">{label}</dt>
            <dd className="order-1 flex items-center gap-1 font-display text-2xl leading-none font-extrabold tabular-nums">
              <Icon aria-hidden="true" className={cn("size-4", key === "streak" && value > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground")} />
              <span key={value} className="motion-safe:animate-pop">
                {value}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {/* The answer stickers, first to last: earned ones stuck on, the rest as empty spots. */}
      <ol aria-label={t("ladderLabel")} className="relative flex items-center justify-between px-1">
        <span aria-hidden="true" className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-border" />
        {QUIZ_LADDER.map((step) => {
          const earned = standing.answers >= step.target;
          return (
            <li key={step.id} className="relative" title={badges(`items.${step.id}.name`)}>
              <span className="sr-only">
                {t("ladderStep", { name: badges(`items.${step.id}.name`), target: step.target, earned: earned ? "yes" : "no" })}
              </span>
              <Sticker
                key={earned ? "on" : "off"}
                id={step.id}
                size="sm"
                locked={!earned}
                className={cn(earned && "motion-safe:animate-stamp", goal?.id === step.id && "ring-4 ring-brand/25")}
              />
            </li>
          );
        })}
      </ol>
      {goal ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm">
            {t.rich("nextSticker", {
              left: goal.target - goal.progress,
              name: badges(`items.${goal.id}.name`),
              b: (chunks) => <strong className="font-bold">{chunks}</strong>,
            })}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(4, ((goal.progress - goal.from) / (goal.target - goal.from)) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold">{t("ladderDone")}</p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <FlameIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        {standing.today
          ? t("streakToday", { count: standing.streak, days: QUIZ_STREAK_DAYS })
          : standing.streak > 0
            ? t("streakKeep", { count: standing.streak })
            : t("streakStart", { days: QUIZ_STREAK_DAYS })}
      </p>
    </section>
  );
}

/** Where the round is: one dot per question, filled as they're answered. */
function RoundDots({ asked }: { asked: number }) {
  const t = useTranslations("Quiz");
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase tabular-nums">{t("roundProgress", { count: asked + 1, total: QUIZ_ROUND })}</p>
      <span aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length: QUIZ_ROUND }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i < asked ? "w-2 bg-brand" : i === asked ? "w-5 bg-brand/50" : "w-2 bg-muted-foreground/25",
            )}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * One question, on a taped index card on a little stack (the questions left in the round). The answer buttons wait
 * `QUIZ_MIN_ANSWER_MS` so there's time to read it. An answer stamps the card; the next one is dealt from the stack.
 */
function QuestionCard({ question, left, sending, onAnswer }: { question: QuizQuestion; left: number; sending: boolean; onAnswer: (choice: QuizChoice) => void }) {
  const t = useTranslations("Quiz");
  const topics = useTranslations("WarningTopics");
  const topicName = useTopicName();
  const placeLabel = usePlaceLabel();
  const [filling, setFilling] = useState(false);
  const [ready, setReady] = useState(false);
  const [stamp, setStamp] = useState<QuizChoice | null>(null);
  const shown = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    shown.current?.focus();
    // The bar starts filling on the next frame, so it runs from empty to full while the question is read.
    const frame = requestAnimationFrame(() => setFilling(true));
    const timer = setTimeout(() => setReady(true), QUIZ_MIN_ANSWER_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  function choose(choice: QuizChoice) {
    setStamp(choice);
    onAnswer(choice);
  }

  const { title } = question;
  const disabled = !ready || sending || stamp !== null;
  return (
    <div className="relative">
      {/* The rest of the round, under this card. */}
      {Array.from({ length: Math.min(left, 2) }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn("absolute inset-x-3 top-0 bottom-0 rounded-3xl bg-card shadow-sm ring-1 ring-border", i === 0 ? "translate-y-2 rotate-[1.5deg]" : "translate-y-4 -rotate-[1.5deg]")}
        />
      ))}
      <article className="relative flex flex-col gap-4 rounded-3xl bg-card p-5 pt-7 shadow-md ring-1 ring-border motion-safe:animate-[deal_520ms_var(--ease-spring)_both]">
        <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-2 rounded-[2px] bg-brand-soft/90 shadow-sm ring-1 ring-brand/10" />
        <div className="flex items-start gap-4">
          <span className="relative aspect-[2/3] w-20 shrink-0 -rotate-3 overflow-hidden rounded-md bg-muted shadow-md ring-4 ring-background">
            {title.posterUrl && <Image src={title.posterUrl} alt="" fill unoptimized sizes="80px" className="object-cover" />}
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            {question.kind === "topic" ? (
              <h2 ref={shown} tabIndex={-1} className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] outline-none">
                {topics(`questions.${question.topic}`, { title: title.name })}
              </h2>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t("warningLead", { kind: title.kind, title: title.name })}</p>
                <p className="inline-flex flex-wrap items-baseline gap-x-2 self-start rounded-xl bg-brand-soft px-3 py-2 ring-1 ring-brand/20">
                  <span className="font-semibold first-letter:uppercase">{topicName(question.topic)}</span>
                  {question.where && <span className="text-sm tabular-nums">{placeLabel(question.where)}</span>}
                </p>
                <h2 ref={shown} tabIndex={-1} className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] outline-none">
                  {t("warningQuestion")}
                </h2>
              </>
            )}
          </div>
        </div>
        {/* Who the answer is for: people who avoid this topic (none shown under 3). */}
        {question.avoiders > 0 && (
          <p className="-mb-1 flex items-center gap-2 rounded-xl bg-brand-soft/60 px-3 py-2 text-sm font-semibold ring-1 ring-brand/15 dark:bg-brand/15">
            <UsersIcon aria-hidden="true" className="size-4 shrink-0 text-brand" />
            {t("avoiders", { count: question.avoiders })}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <ShieldCheckIcon aria-hidden="true" className="size-3.5 shrink-0" />
          {question.kind === "topic"
            ? t("topicProgress", { count: question.answers, total: QUIZ_ANSWERS_TO_RESOLVE })
            : t("warningProgress", { count: question.answers, total: SCENE_CONFIRMATIONS })}
        </p>
        {/* Fills while the question is being read; the buttons wake up when it's full. */}
        <div aria-hidden="true" className={cn("h-1 overflow-hidden rounded-full bg-muted transition-opacity duration-500", ready && "opacity-0")}>
          <div
            className={cn("h-full rounded-full bg-brand/60 transition-[width] ease-linear motion-reduce:transition-none", filling ? "w-full" : "w-0")}
            style={{ transitionDuration: `${QUIZ_MIN_ANSWER_MS}ms` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["yes", "no"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={disabled}
              onClick={() => choose(choice)}
              className={cn(
                "flex h-14 items-center justify-center rounded-2xl text-lg font-bold shadow-sm transition-opacity press disabled:opacity-50",
                choice === "yes" ? "bg-brand text-brand-foreground hover:bg-brand/90" : "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              {t(choice)}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => choose("unsure")}
          className="inline-flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {t("unsure")}
        </button>
        {/* The answer, stamped onto the card like a rubber stamp. */}
        {stamp && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "rounded-xl border-4 px-4 py-1 font-display text-4xl font-black tracking-wider uppercase opacity-90 mix-blend-multiply motion-safe:animate-stamp motion-reduce:-rotate-6 dark:mix-blend-screen",
                stamp === "yes" ? "border-brand text-brand" : stamp === "no" ? "border-foreground text-foreground" : "border-muted-foreground text-muted-foreground",
              )}
            >
              {t(`stamp.${stamp}`)}
            </span>
          </span>
        )}
      </article>
    </div>
  );
}

/** The end of a round: what it did, the streak, the next sticker, and another round or a rest. */
function RoundDone({ round, standing, onAgain }: { round: Round; standing: QuizStanding; onAgain: () => void }) {
  const t = useTranslations("Quiz");
  const badges = useTranslations("Badges");
  const heading = useRef<HTMLHeadingElement>(null);
  const goal = nextQuizSticker(standing.answers);
  useEffect(() => heading.current?.focus(), []);
  const lines = [
    round.helped > 0 && { key: "helped", icon: HandHeartIcon, text: t("roundHelped", { count: round.helped }) },
    round.settled > 0 && { key: "settled", icon: GavelIcon, text: t("roundSettled", { count: round.settled }) },
    round.confirmed > 0 && { key: "confirmed", icon: ShieldCheckIcon, text: t("roundConfirmed", { count: round.confirmed }) },
    round.reach > 0 && { key: "reach", icon: UsersIcon, text: t("roundReach", { count: round.reach }) },
    standing.streak > 0 && { key: "streak", icon: FlameIcon, text: t("roundStreak", { count: standing.streak }) },
  ].filter((line) => line !== false);
  return (
    <section aria-labelledby="round-done" className="relative flex flex-col items-center gap-4 rounded-3xl bg-card px-5 pt-8 pb-5 text-center shadow-md ring-1 ring-border motion-safe:animate-[deal_520ms_var(--ease-spring)_both]">
      <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 rounded-[2px] bg-brand-soft/90 shadow-sm ring-1 ring-brand/10" />
      <Stonie size={64} />
      <h2 id="round-done" ref={heading} tabIndex={-1} className="font-display text-3xl font-extrabold tracking-[-0.02em] outline-none">
        {round.helped > 0 ? t("roundDoneTitle") : t("roundQuietTitle")}
      </h2>
      {lines.length > 0 && (
        <ul className="flex w-full flex-col gap-2 text-left">
          {lines.map(({ key, icon: Icon, text }, i) => (
            <li
              key={key}
              style={{ animationDelay: `${200 + i * 120}ms` }}
              className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm font-semibold motion-safe:animate-enter"
            >
              <Icon aria-hidden="true" className={cn("size-5 shrink-0", key === "streak" ? "text-orange-600 dark:text-orange-400" : "text-brand")} />
              {text}
            </li>
          ))}
        </ul>
      )}
      {goal && (
        <p className="flex items-center gap-3 text-left text-sm text-muted-foreground">
          <Sticker id={goal.id} size="sm" locked />
          <span>
            {t.rich("nextSticker", {
              left: goal.target - goal.progress,
              name: badges(`items.${goal.id}.name`),
              b: (chunks) => <strong className="font-bold text-foreground">{chunks}</strong>,
            })}
          </span>
        </p>
      )}
      <div className="flex w-full flex-col gap-2">
        <button type="button" onClick={onAgain} className="flex h-12 items-center justify-center rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press">
          {t("anotherRound")}
        </button>
        <Link href="/home" className="flex min-h-11 items-center justify-center rounded-full text-sm font-semibold text-muted-foreground hover:bg-muted">
          {t("doneForNow")}
        </Link>
      </div>
    </section>
  );
}

function EmptyCard({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-10 text-center">
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
      {cta && (
        <Link href={cta.href} className="mt-1 flex h-12 items-center rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
