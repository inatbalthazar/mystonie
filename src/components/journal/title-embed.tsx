import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { posterUrl } from "@/core/catalog/images";
import type { TitleKind } from "@/core/catalog/types";
import { ensureTitle } from "@/data/titles";
import { Link } from "@/i18n/navigation";

/**
 * `@[movie:603]` in a Journal article: the title from our catalog cache as a taped-in poster with Add, which opens
 * quick add on it (`/collection?add=1&pick=…`, through sign-in for visitors). When the catalog can't be reached, the
 * article's label stands in.
 */
export async function TitleEmbed({ kind, externalId, label, index }: { kind: TitleKind; externalId: string; label: string | null; index: number }) {
  const [found, t] = await Promise.all([ensureTitle(kind, externalId).catch(() => null), getTranslations("Journal")]);
  const title = found?.title;
  const name = title?.name ?? label;
  if (!name) return null;
  const poster = title ? posterUrl(title.source, title.posterPath) : null;
  const href = `/title/${kind}/${externalId}`;

  return (
    <div className={`not-prose my-2 flex items-center gap-4 rounded-2xl bg-card p-3 pr-4 shadow-md ring-1 ring-border ${index % 2 ? "rotate-[0.6deg]" : "rotate-[-0.6deg]"}`}>
      <Link href={href} className="relative aspect-[2/3] w-16 shrink-0 -rotate-2 overflow-hidden rounded-md bg-muted shadow ring-2 ring-card">
        {poster && <Image src={poster} alt="" fill unoptimized sizes="64px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={href} className="line-clamp-2 font-display text-lg leading-tight font-bold hover:underline">
          {name}
        </Link>
        <p className="text-sm text-muted-foreground">
          {t("kind", { kind })}
          {title?.year ? ` · ${title.year}` : null}
        </p>
      </div>
      <Link
        href={{ pathname: "/collection", query: { add: "1", pick: `${kind}:${externalId}` } }}
        aria-label={t("addLabel", { name })}
        className="flex min-h-11 shrink-0 items-center rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground transition-transform hover:bg-brand/90 active:scale-95"
      >
        {t("add")}
      </Link>
    </div>
  );
}
