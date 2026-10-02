"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeToast } from "@/components/badges/badge-toast";
import type { BadgeNews } from "@/core/badges";
import { QUIZ_ANSWERS_TO_RESOLVE, QUIZ_MIN_ANSWER_MS, type QuizChoice, type QuizQuestion, type QuizResult, type QuizServe } from "@/core/quiz";
import { SCENE_CONFIRMATIONS } from "@/core/scene-warnings";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { usePlaceLabel, useTopicName } from "./scene-place";

type State = { kind: "loading" } | { kind: "error" } | { kind: "served"; serve: QuizServe };
type Note = { tone: "good" | "warn"; text: string } | null;

/**
 * The warnings quiz (S3 warnings & quiz): one question at a time about titles the user finished, from GET /api/quiz,
 * answered with POST /api/quiz. The server times every answer; the buttons wake up only after a question has been on
 * screen long enough to read (the same 1.5 s the server requires), so honest answers always count. No Gems: the
 * point is helping others skip what they'd rather not see. Helping earns stickers, though (Lookout, Guardian; ADR 0063).
 */
export function WarningsQuiz({ titleId }: { titleId: string | null }) {
  const t = useTranslations("Quiz");
  const format = useFormatter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [note, setNote] = useState<Note>(null);
  const [answered, setAnswered] = useState(0);
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
      const res = await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: question.id, choice }) });
      if (!res.ok) throw new Error(String(res.status));
      const result = (await res.json()) as QuizResult & { badges?: BadgeNews[] };
      if (result.badges?.length) setStickers(result.badges);
      if (result.status === "paused") {
        setNote(null);
        setState({ kind: "served", serve: { status: "paused", until: result.until } });
        return;
      }
      setNote(feedback(question, result));
      if (result.status === "counted" || result.status === "not_counted") {
        setAnswered((n) => n + 1);
        track("quiz_answered", { kind: question.kind, choice, counted: result.status === "counted" });
      }
      await next();
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
      return { tone: "good", text: t("settled", { title: question.title.name, result: result.result }) };
    }
    if (result.kind === "warning" && result.result === "confirmed" && question.answers < SCENE_CONFIRMATIONS) return { tone: "good", text: t("confirmedNow") };
    return { tone: "good", text: t("thanks") };
  }

  if (state.kind === "loading") {
    return <div aria-hidden="true" className="h-72 skeleton rounded-3xl" />;
  }
  if (state.kind === "error") {
    return (
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
    );
  }

  const { serve } = state;
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className={cn("min-h-5 text-sm", note?.tone === "warn" ? "font-semibold text-destructive" : "text-muted-foreground")}>
        {note?.text}
      </p>
      {serve.status === "question" ? (
        <QuestionCard key={serve.id} question={serve} sending={sending} onAnswer={(choice) => answer(serve, choice)} />
      ) : serve.status === "paused" ? (
        <EmptyCard title={t("pausedTitle")} body={t("pausedBody", { time: format.dateTime(new Date(serve.until), { hour: "numeric", minute: "2-digit" }) })} />
      ) : serve.status === "no_finishes" ? (
        <EmptyCard title={t("noFinishesTitle")} body={t("noFinishesBody")} cta={{ href: "/collection", label: t("toCollection") }} />
      ) : (
        <EmptyCard title={t("doneTitle")} body={t("doneBody")} cta={{ href: "/home", label: t("back") }} />
      )}
      {answered > 0 && <p className="text-center text-xs text-muted-foreground tabular-nums">{t("answered", { count: answered })}</p>}
      {stickers.length > 0 && <BadgeToast key={stickers.map((b) => b.id).join()} badges={stickers} onClose={() => setStickers([])} />}
    </div>
  );
}

/** One question, on a taped index card. The answer buttons wait `QUIZ_MIN_ANSWER_MS` so there's time to read it. */
function QuestionCard({ question, sending, onAnswer }: { question: QuizQuestion; sending: boolean; onAnswer: (choice: QuizChoice) => void }) {
  const t = useTranslations("Quiz");
  const topics = useTranslations("WarningTopics");
  const topicName = useTopicName();
  const placeLabel = usePlaceLabel();
  const [filling, setFilling] = useState(false);
  const [ready, setReady] = useState(false);
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

  const { title } = question;
  const disabled = !ready || sending;
  return (
    <article className="relative flex flex-col gap-4 rounded-3xl bg-card p-5 pt-7 shadow-md ring-1 ring-border">
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
      <p className="text-xs text-muted-foreground tabular-nums">
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
            onClick={() => onAnswer(choice)}
            className={cn(
              "flex h-14 items-center justify-center rounded-2xl text-lg font-bold shadow-sm transition-opacity disabled:opacity-50",
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
        onClick={() => onAnswer("unsure")}
        className="inline-flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {t("unsure")}
      </button>
    </article>
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
