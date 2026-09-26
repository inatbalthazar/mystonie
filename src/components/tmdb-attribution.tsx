import Image from "next/image";
import { useTranslations } from "next-intl";

// Required by TMDB's API terms wherever their data is shown: logo + notice.
export function TmdbAttribution() {
  const t = useTranslations("Attribution");

  return (
    <a
      href="https://www.themoviedb.org/"
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-xs items-center gap-2 text-xs text-muted-foreground"
    >
      <Image src="/attribution/tmdb.svg" alt="TMDB" width={72} height={9} className="h-auto shrink-0" />
      <span>{t("tmdb")}</span>
    </a>
  );
}
