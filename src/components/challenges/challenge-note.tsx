import { useFormatter, useTranslations } from "next-intl";
import type { ChallengeSlug } from "@/core/challenges";
import { Link } from "@/i18n/navigation";
import { ChallengePatch } from "./patch";
import { Reveal } from "@/components/motion/reveal";

export type NoteChallenge = { slug: ChallengeSlug; target: number; value: number; joined: boolean; completed: boolean };

const SHOWN = 3;

/**
 * Home's "This month's challenges" (S3 challenges & clubs): the ones you joined with how far along you are, or,
 * before you join any, the month's lineup as an invitation. Progress is what the last save recorded.
 */
export function ChallengeNote({ month, challenges }: { month: string; challenges: NoteChallenge[] }) {
  const t = useTranslations("Challenges");
  const format = useFormatter();
  const joined = challenges.filter((c) => c.joined);
  const shown = (joined.length ? joined : challenges).slice(0, SHOWN);
  const monthName = format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: "long", timeZone: "UTC" });

  return (
    <section aria-labelledby="challenge-note" className="relative flex rotate-[0.4deg] flex-col gap-3 rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border">
      <span aria-hidden="true" className="absolute -top-2.5 left-8 h-5 w-16 rotate-[-4deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="challenge-note" className="font-display text-xl font-extrabold">
          {t("homeTitle")}
        </h2>
        <Link href="/challenges" className="flex min-h-11 shrink-0 items-center text-sm font-semibold text-brand">
          {t("homeCta")}
        </Link>
      </div>
      {joined.length === 0 && <p className="font-hand text-xl leading-tight">{t("homeInvite", { count: challenges.length, month: monthName })}</p>}
      <ul className="flex flex-col gap-3">
        {shown.map((c) => (
          <li key={c.slug} className="flex items-center gap-3">
            <ChallengePatch slug={c.slug} size={40} locked={!c.completed} className={c.completed ? "rotate-[-8deg]" : undefined} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{t(`items.${c.slug}.name`)}</span>
                {c.joined && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {c.completed ? t("completed") : t("friendProgress", { value: format.number(Math.min(c.value, c.target)), target: format.number(c.target) })}
                  </span>
                )}
              </p>
              {c.joined ? (
                <Reveal aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-border">
                  <div className="grow-w h-full rounded-full bg-brand" style={{ width: `${(Math.min(c.value, c.target) / c.target) * 100}%` }} />
                </Reveal>
              ) : (
                <p className="truncate text-xs text-muted-foreground">{t(`items.${c.slug}.how`)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {joined.length > SHOWN && <p className="text-xs text-muted-foreground">{t("homeMore", { count: joined.length - SHOWN })}</p>}
    </section>
  );
}
