import { useTranslations } from "next-intl";
import type { TitleKind } from "@/core/catalog/types";
import { clubsForTitle } from "@/core/clubs";
import { Link } from "@/i18n/navigation";
import { ClubCrest } from "../clubs/crest";

/**
 * "Clubs for this" on a title page (S3 challenges & clubs): the fandom clubs whose filter the title fits, as crests
 * that lead to each club. Nothing when none fits.
 */
export function TitleClubs({ title }: { title: { kind: TitleKind; genres: readonly string[]; originalLanguage: string | null } }) {
  const t = useTranslations("Clubs");
  const clubs = clubsForTitle(title);
  if (clubs.length === 0) return null;
  return (
    <section aria-labelledby="title-clubs" className="flex flex-col gap-2">
      <h2 id="title-clubs" className="font-display text-lg font-extrabold">
        {t("titleClubs")}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {clubs.map((club, i) => (
          <li key={club}>
            <Link href={`/clubs/${club}`} className="flex min-h-11 items-center gap-2 rounded-full bg-card py-1 pr-4 pl-2 text-sm font-semibold shadow-sm ring-1 ring-border hover:bg-muted">
              <ClubCrest club={club} size={26} className={i % 2 ? "rotate-[5deg]" : "rotate-[-5deg]"} />
              {t(`items.${club}.name`)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
