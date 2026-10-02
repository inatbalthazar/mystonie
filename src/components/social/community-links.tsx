import { ClapperboardIcon, FlagIcon, ShieldIcon, TrophyIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/board", icon: TrophyIcon, name: "board" },
  { href: "/challenges", icon: FlagIcon, name: "challenges" },
  { href: "/clubs", icon: ShieldIcon, name: "clubs" },
  { href: "/reel", icon: ClapperboardIcon, name: "reel" },
  { href: "/people", icon: UsersIcon, name: "people" },
] as const;

const TILTS = ["rotate-[-1.5deg]", "rotate-[1deg]", "rotate-[-0.5deg]", "rotate-[1.5deg]", "rotate-[-1deg]"];

/**
 * The community pages on Home (ADR 0078): the board, challenges, clubs, the Reel of the Day and Find people, five
 * shortcuts side by side, all in sight at 360px. No row to swipe: nobody had to guess there was more past the edge.
 */
export function CommunityLinks() {
  const t = useTranslations("HomeApp");
  return (
    <nav aria-label={t("community")} className="-mx-2 -mt-3">
      <ul className="grid grid-cols-5 gap-1">
        {LINKS.map(({ href, icon: Icon, name }, i) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex min-h-11 flex-col items-center gap-1.5 rounded-2xl px-0.5 py-2 text-center hover:bg-muted press"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-12 items-center justify-center rounded-2xl bg-card text-brand shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5",
                  TILTS[i],
                )}
              >
                <Icon className="size-[22px]" strokeWidth={2} />
              </span>
              <span className="text-[11px] leading-tight font-semibold tracking-[-0.01em] text-foreground [overflow-wrap:anywhere] sm:text-xs">
                {t(`communityLink.${name}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
