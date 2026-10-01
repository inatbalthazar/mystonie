import { useTranslations } from "next-intl";
import { Avatar } from "@/components/social/avatar";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const STONIE_PHOTO = "/journal/authors/stonie.svg";

/**
 * Who wrote a Journal article (ADR 0052): their photo (else their initial, or Stonie for the team) and `label`,
 * linking to their page on Mystonie when the article names it (`profile`). Rows say the name; the article page says
 * "By …" in handwriting (`page`).
 */
export function Byline({
  author,
  avatar,
  profile,
  page = false,
  className,
}: {
  author: string | null;
  avatar: string | null;
  profile: string | null;
  page?: boolean;
  className?: string;
}) {
  const t = useTranslations("Journal");
  const name = author ?? t("defaultAuthor");
  const size = page ? "size-9" : "size-6";
  // Stonie (by name, or the team by default) always has the mascot's photo, so an article needs no avatar line for it.
  const stonie = !author || author.trim().toLowerCase() === "stonie";
  const photo = stonie ? (
    // eslint-disable-next-line @next/next/no-img-element -- Stonie, the team's mascot
    <img src={STONIE_PHOTO} alt="" width={36} height={36} className={cn(size, "shrink-0 rounded-full ring-1 ring-border")} />
  ) : avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- a small photo from public/journal/ or the writer's https link
    <img src={avatar} alt="" width={36} height={36} className={cn(size, "shrink-0 rounded-full object-cover ring-1 ring-border")} />
  ) : (
    <Avatar name={author} url={null} className={cn(size, page ? "text-base" : "text-xs")} />
  );
  const body = (
    <>
      {photo}
      <span className={cn("min-w-0 truncate", page ? "font-hand text-2xl leading-none" : "text-sm font-semibold")}>
        {page ? t("by", { author: name }) : name}
      </span>
    </>
  );
  const look = cn("flex min-w-0 items-center gap-2", className);
  return profile ? (
    <Link href={`/u/${profile}`} className={cn(look, "rounded-full hover:underline")}>
      {body}
    </Link>
  ) : (
    <span className={look}>{body}</span>
  );
}
