"use client";

import { CheckIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Celebration } from "@/components/celebration";
import { Avatar } from "@/components/social/avatar";
import type { ChallengeSlug, ChallengeUnit } from "@/core/challenges";
import type { CardData } from "@/core/cards/types";
import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { ChallengePatch } from "./patch";

type Problem = null | "closed" | "limited" | "error";

export type ChallengeFriend = { id: string; username: string; name: string; avatarUrl: string | null; value: number; completed: boolean };

const TILTS = ["rotate-[-0.5deg]", "rotate-[0.4deg]", "rotate-[-0.2deg]", "rotate-[0.6deg]"];

/**
 * One of the month's challenges on /challenges (S3 challenges & clubs): its patch, what it asks, how far along you
 * are, Join / Leave, how many joined and completed it, and which of the people you follow are in. A completed one
 * gets the patch sewn on, the date, and "Make the card" (the Challenge card's celebration). Joining counts the whole
 * month at once, so it can complete the challenge on the spot.
 */
export function ChallengePanel({
  index,
  month,
  slug,
  target,
  unit,
  value: initialValue,
  joined: initialJoined,
  completedOn,
  card,
  counts,
  friends,
  username,
  host,
}: {
  index: number;
  month: string;
  slug: ChallengeSlug;
  target: number;
  unit: ChallengeUnit;
  value: number;
  joined: boolean;
  /** `YYYY-MM-DD` it was completed on, if it was. */
  completedOn: string | null;
  /** The Challenge card's inputs once completed. */
  card: CardData | null;
  counts: { joined: number; completed: number };
  friends: ChallengeFriend[];
  username: string | null;
  host: string;
}) {
  const t = useTranslations("Challenges");
  const format = useFormatter();
  const router = useRouter();
  const [joined, setJoined] = useState(initialJoined);
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [celebrate, setCelebrate] = useState<CardData | null>(null);
  const done = completedOn !== null;
  const shown = Math.min(value, target);

  async function toggle() {
    const want = !joined;
    setJoined(want);
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, slug, join: want }),
      });
      if (!res.ok) {
        setJoined(!want);
        setProblem(res.status === 409 ? "closed" : res.status === 429 ? "limited" : "error");
        if (res.status === 409) router.refresh();
        return;
      }
      const body = (await res.json()) as { progress: number | null; completed: CardData | null };
      if (want) {
        track("challenge_joined", { challenge: slug });
        if (typeof body.progress === "number") setValue(body.progress);
        // Everything since the 1st counts: joining can complete it at once.
        if (body.completed) setCelebrate(body.completed);
        else router.refresh();
      } else router.refresh();
    } catch {
      setJoined(!want);
      setProblem("error");
    } finally {
      setBusy(false);
    }
  }

  const doneDate = completedOn ? format.dateTime(new Date(`${completedOn}T00:00:00Z`), { month: "short", day: "numeric", timeZone: "UTC" }) : "";

  return (
    <article
      aria-labelledby={`challenge-${slug}`}
      className={cn("relative flex flex-col gap-3 rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border", TILTS[index % TILTS.length], done && "ring-brand/40")}
    >
      <span aria-hidden="true" className="absolute -top-2.5 left-10 h-5 w-16 rotate-[-4deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      <div className="flex items-start gap-4">
        <ChallengePatch slug={slug} size={64} locked={!done} className={done ? "rotate-[-8deg]" : undefined} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`challenge-${slug}`} className="font-display text-xl leading-tight font-extrabold">
            {t(`items.${slug}.name`)}
          </h2>
          <p className="text-sm text-muted-foreground">{t(`items.${slug}.how`)}</p>
        </div>
        {done && (
          <span aria-hidden="true" className="shrink-0 rotate-[8deg] rounded-md border-2 border-brand px-2 py-0.5 font-display text-[11px] font-extrabold tracking-[0.16em] text-brand uppercase">
            {t("completed")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={shown}
          aria-label={t("progress", { value: format.number(shown), target: format.number(target), unit })}
          className="h-3 overflow-hidden rounded-full bg-muted ring-1 ring-border"
        >
          <div className={cn("h-full rounded-full transition-[width]", done ? "bg-brand" : "bg-brand/70")} style={{ width: `${(shown / target) * 100}%` }} />
        </div>
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="font-semibold tabular-nums">{t("progress", { value: format.number(shown), target: format.number(target), unit })}</span>
          <span className="text-xs text-muted-foreground">{t("counts", counts)}</span>
        </p>
      </div>

      {friends.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted-foreground">{t("friends")}</p>
          <ul className="flex flex-wrap gap-2">
            {friends.map((f) => (
              <li key={f.id}>
                <Link href={`/u/${f.username}`} className="flex min-h-11 items-center gap-2 rounded-full bg-muted/60 py-1 pr-3 pl-1 text-sm hover:bg-muted">
                  <Avatar name={f.name} url={f.avatarUrl} className="size-8 text-sm" />
                  <span className="max-w-[8rem] truncate font-medium">{f.name}</span>
                  {f.completed ? (
                    <CheckIcon className="size-4 text-brand" aria-label={t("completed")} />
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">{t("friendProgress", { value: format.number(Math.min(f.value, target)), target: format.number(target) })}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {done ? (
          <>
            <p className="font-hand text-lg leading-tight text-muted-foreground">{t("completedOn", { date: doneDate })}</p>
            {card && (
              <button
                type="button"
                onClick={() => setCelebrate(card)}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground shadow-sm hover:bg-brand/90"
              >
                <SparklesIcon className="size-4" aria-hidden="true" />
                {t("makeCard")}
              </button>
            )}
          </>
        ) : (
          <>
            <span aria-live="polite" className="text-xs text-destructive">
              {problem ? t("problem", { problem }) : ""}
            </span>
            {joined ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggle}
                  disabled={busy}
                  className="inline-flex h-11 items-center px-3 text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
                >
                  {t("leave")}
                </button>
                <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-card px-4 text-sm font-bold ring-1 ring-brand/50">
                  <CheckIcon className="size-4 text-brand" aria-hidden="true" />
                  {t("joined")}
                </span>
              </span>
            ) : (
              <button
                type="button"
                onClick={toggle}
                disabled={busy}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground shadow-sm transition-colors hover:bg-brand/90"
              >
                <PlusIcon className="size-4" aria-hidden="true" />
                {t("join")}
              </button>
            )}
          </>
        )}
      </div>

      {celebrate && (
        <Celebration
          data={celebrate}
          source={{ kind: "challenge", ready: true }}
          animate={!done}
          username={username}
          host={host}
          onClose={() => {
            setCelebrate(null);
            router.refresh();
          }}
        />
      )}
    </article>
  );
}
