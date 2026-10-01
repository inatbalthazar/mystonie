import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Required by TMDB's API terms: logo + notice. `compact` (the footer, ADR 0065): signed in, only the logo shows (the
// notice stays its accessible name), since the full notice is in Settings → About.
export function TmdbAttribution({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Attribution");

  return (
    <a
      href="https://www.themoviedb.org/"
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-xs items-center gap-2 text-xs text-muted-foreground"
    >
      <Image src="/attribution/tmdb.svg" alt="TMDB" width={72} height={9} className="h-auto shrink-0" />
      <span className={cn(compact && "signed-in:sr-only")}>{t("tmdb")}</span>
    </a>
  );
}
