import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { SubjectCard } from "@/data/journal-posts";
import { Link } from "@/i18n/navigation";
import { PassportStamp } from "./passport-stamp";

const TILTS = ["rotate-[-1.2deg]", "rotate-[0.9deg]", "rotate-[-0.5deg]"];

/**
 * What a member's article is about (ADR 0092): each title as a taped-in poster with its name, kind and year, each
 * place as a passport stamp, and a coral Check that opens it as Trending's posters do: quick add on the title
 * (details, warnings, Add; visitors sign in first), or the place's sheet on the Atlas. A row that swipes sideways
 * when there are several.
 */
export async function SubjectStrip({ subjects }: { subjects: readonly SubjectCard[] }) {
  if (subjects.length === 0) return null;
  const t = await getTranslations("Journal");
  return (
    <section aria-labelledby="about-subjects" className="flex flex-col gap-3">
      <h2 id="about-subjects" className="font-hand text-2xl leading-none text-muted-foreground">
        {t("aboutTitle")}
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-2 pb-3 [scrollbar-width:none]">
        {subjects.map((s, i) => {
          const href =
            s.kind === "place"
              ? { pathname: "/collection/atlas", query: { country: s.country.toLowerCase() } }
              : { pathname: "/collection", query: { add: "1", pick: `${s.kind}:${s.externalId}` } };
          return (
            <li
              key={s.kind === "place" ? `place:${s.country}` : `${s.kind}:${s.externalId}`}
              className={`flex w-[min(15rem,78vw)] shrink-0 snap-start items-center gap-3 rounded-2xl bg-card p-3 shadow-md ring-1 ring-border ${TILTS[i % TILTS.length]} ${subjects.length === 1 ? "w-full max-w-sm" : ""}`}
            >
              {s.kind === "place" ? (
                <PassportStamp country={s.country} className="w-14 shrink-0 text-[11px]" />
              ) : (
                <span className="relative aspect-[2/3] w-14 shrink-0 -rotate-2 overflow-hidden rounded-md bg-muted shadow ring-2 ring-card">
                  {s.posterUrl && <Image src={s.posterUrl} alt="" fill unoptimized sizes="56px" className="object-cover" />}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-2 font-display leading-tight font-bold">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.kind === "place" ? t("place") : t("kind", { kind: s.kind })}
                  {s.kind !== "place" && s.year ? ` · ${s.year}` : null}
                </span>
                <Link
                  href={href}
                  aria-label={t("checkLabel", { name: s.name })}
                  className="mt-1 flex min-h-11 items-center self-start rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground transition-transform hover:bg-brand/90 active:scale-95"
                >
                  {t("check")}
                </Link>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
