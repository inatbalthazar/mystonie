import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// RAWG's API terms (ADR 0044): name RAWG as the source of game data and images, with an active link, on every page
// that shows them. It sits in the footer of every page, signed in too (ADR 0065), next to TMDB's notice; the game page
// and Settings → About credit it as well.
export function RawgAttribution({ className }: { className?: string }) {
  const t = useTranslations("Attribution");
  return (
    <a
      href="https://rawg.io/"
      target="_blank"
      rel="noopener noreferrer"
      className={cn("max-w-xs text-center text-xs text-muted-foreground underline-offset-4 hover:underline", className)}
    >
      {t("rawg")}
    </a>
  );
}
