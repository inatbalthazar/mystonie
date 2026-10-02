import { NotebookPenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Home's note for the newest Journal article (stage 4, ADR 0051), from its first 45 days. */
export function JournalNote({ slug, title, written }: { slug: string; title: string; written: string | null }) {
  const t = useTranslations("Journal");
  return (
    <Link href={`/journal/${slug}`} className="group relative flex rotate-[0.4deg] items-center gap-3 rounded-2xl bg-card p-4 shadow-md ring-1 ring-border hover:ring-brand/50">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-brand/20">
        <NotebookPenIcon className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-muted-foreground">{t("latest")}</span>
        <span lang={written ?? undefined} className="line-clamp-2 font-display text-lg leading-tight font-extrabold">
          {title}
        </span>
      </span>
      <span className="inline-flex h-11 shrink-0 items-center rounded-full bg-brand px-4 font-semibold text-brand-foreground group-hover:bg-brand/90 press">{t("readMore")}</span>
    </Link>
  );
}

/** How long Home shows a new article. */
export const JOURNAL_NOTE_DAYS = 45;
