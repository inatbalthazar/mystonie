"use client";

import { useLocale, useTranslations } from "next-intl";
import { isClubSlug } from "@/core/clubs";
import { countryName } from "@/core/countries";
import { suggestionReason, type SuggestedPerson } from "@/core/social";
import { FollowButton } from "./follow-button";
import { PersonRow } from "./person-row";

/**
 * Suggested for you on Find people (ADR 0083): people to follow, each with one line on why (titles in common, people
 * you follow who follow them, a club, a country, or that they finish a lot). Following one keeps them in the list, with
 * the button showing it, until the next visit.
 */
export function SuggestedPeople({ people }: { people: SuggestedPerson[] }) {
  const t = useTranslations("Social");
  const tc = useTranslations("Clubs");
  const locale = useLocale();

  function reason(person: SuggestedPerson): string {
    const r = suggestionReason(person);
    switch (r.kind) {
      case "mutuals":
        return t("reasonMutuals", { count: r.count });
      case "shared":
        return t("reasonShared", { count: r.count, title: r.title });
      case "club":
        return isClubSlug(r.club) ? t("reasonClub", { club: tc(`items.${r.club}.name`) }) : t("reasonActive", { count: person.finished });
      case "country":
        return t("reasonCountry", { country: countryName(r.country, locale) });
      case "active":
        return t("reasonActive", { count: r.finished });
    }
  }

  return (
    <section aria-labelledby="suggested" className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h2 id="suggested" className="font-display text-xl font-extrabold">
          {t("suggestedTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("suggestedHint")}</p>
      </div>
      <ul className="stagger flex flex-col divide-y divide-dashed divide-border">
        {people.map((p) => (
          <li key={p.id}>
            <PersonRow
              person={p}
              note={<span className="mt-0.5 block truncate text-foreground/80">{reason(p)}</span>}
              action={<FollowButton userId={p.id} following={false} via="suggested" />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
