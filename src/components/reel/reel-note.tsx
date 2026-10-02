import { ClapperboardIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { REEL_GUESSES } from "@/core/reel";
import { Link } from "@/i18n/navigation";

/**
 * Home's Reel of the Day note (stage 4 daily game): today's number and where the player is: not played yet, guesses
 * left, or the result with "come back tomorrow". A coral dot on its corner until today's is finished (ADR 0074).
 */
export function ReelNote({ number, play }: { number: number; play: { guesses: number; solved: boolean; finished: boolean } | null }) {
  const t = useTranslations("Reel");
  const line = !play
    ? t("homePlay")
    : play.solved
      ? t("homeSolved", { count: play.guesses })
      : play.finished
        ? t("homeLost")
        : t("homePlaying", { count: REEL_GUESSES - play.guesses });
  return (
    <Link href="/reel" className="group relative flex -rotate-[0.5deg] items-center gap-3 rounded-2xl bg-card p-4 shadow-md ring-1 ring-border hover:ring-brand/50">
      <span aria-hidden="true" className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-brand/20">
        <ClapperboardIcon className="size-6" />
        {!play?.finished && <span data-feed-dot="reel" className="absolute -top-1 -right-1 size-3 rounded-full bg-brand ring-2 ring-card" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-lg font-extrabold">{t("homeTitle", { number })}</span>
        <span className="text-sm text-muted-foreground">{line}</span>
      </span>
      {!play?.finished && (
        <span className="inline-flex h-11 shrink-0 items-center rounded-full bg-brand px-4 font-semibold text-brand-foreground group-hover:bg-brand/90 press">{t("homeCta")}</span>
      )}
    </Link>
  );
}
