import { FlameIcon, MessageCircleQuestionIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sticker } from "@/components/badges/sticker";
import { nextQuizSticker, type QuizStanding } from "@/core/quiz-standing";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Home's invitation to the warnings quiz (S3 warnings & quiz), for someone who has finished something. With their
 * standing (ADR 0094) it says what's at stake today: a streak to keep, today's done, or the next sticker.
 */
export function QuizNote({ standing }: { standing: QuizStanding | null }) {
  const t = useTranslations("Quiz");
  const badges = useTranslations("Badges");
  const goal = standing ? nextQuizSticker(standing.answers) : null;
  const streak = standing && standing.streak > 0 ? standing : null;
  const line = streak
    ? streak.today
      ? t("homeStreakDone", { count: streak.streak })
      : t("homeStreakKeep", { count: streak.streak })
    : goal && standing && standing.answers > 0
      ? t("homeNext", { left: goal.target - goal.progress, name: badges(`items.${goal.id}.name`) })
      : null;
  return (
    <section aria-labelledby="quiz-note" className="relative flex -rotate-[0.4deg] items-center gap-4 rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border">
      <span aria-hidden="true" className="absolute -top-2.5 right-10 h-5 w-14 rotate-[5deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      {goal && standing && standing.answers > 0 ? (
        <Sticker id={goal.id} size="md" locked className="rotate-[-6deg]" />
      ) : (
        <span aria-hidden="true" className="flex size-12 shrink-0 rotate-[-6deg] items-center justify-center rounded-full bg-brand-soft text-brand ring-2 ring-brand/20">
          <MessageCircleQuestionIcon className="size-6" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="quiz-note" className="font-display text-lg font-extrabold">
          {t("homeTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("homeBody")}</p>
        {line && (
          <p className={cn("flex items-start gap-1.5 text-sm font-semibold", streak && !streak.today && "text-orange-700 dark:text-orange-400")}>
            {streak && <FlameIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
            {line}
          </p>
        )}
        <Link href="/quiz" className="flex min-h-11 items-center self-start text-sm font-semibold text-brand">
          {t("homeCta")}
        </Link>
      </div>
    </section>
  );
}
