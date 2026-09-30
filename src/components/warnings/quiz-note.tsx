import { MessageCircleQuestionIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Home's invitation to the warnings quiz (S3 warnings & quiz), for someone who has finished something. */
export function QuizNote() {
  const t = useTranslations("Quiz");
  return (
    <section aria-labelledby="quiz-note" className="relative flex -rotate-[0.4deg] items-center gap-4 rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border">
      <span aria-hidden="true" className="absolute -top-2.5 right-10 h-5 w-14 rotate-[5deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      <span aria-hidden="true" className="flex size-12 shrink-0 rotate-[-6deg] items-center justify-center rounded-full bg-brand-soft text-brand ring-2 ring-brand/20">
        <MessageCircleQuestionIcon className="size-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="quiz-note" className="font-display text-lg font-extrabold">
          {t("homeTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("homeBody")}</p>
        <Link href="/quiz" className="flex min-h-11 items-center self-start text-sm font-semibold text-brand">
          {t("homeCta")}
        </Link>
      </div>
    </section>
  );
}
