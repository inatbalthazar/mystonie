import { useTranslations } from "next-intl";

// RAWG's API terms (ADR 0044): name RAWG as the source of game data and images, with an active link, on every page
// that shows them. It sits in the footer of every page, next to TMDB's notice; the game page credits it as well.
export function RawgAttribution() {
  const t = useTranslations("Attribution");
  return (
    <a href="https://rawg.io/" target="_blank" rel="noopener noreferrer" className="max-w-xs text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
      {t("rawg")}
    </a>
  );
}
