import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaperCard } from "@/components/paper-card";
import { localizedPath, safeNextPath } from "@/core/auth";
import { isSignInAction } from "@/core/email/sign-in";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AuthConfirm");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Where the link in the sign-in email lands (`?token_hash=…&type=…&next=…`). Signing in takes a tap
 * (POST /api/auth/confirm), because mail scanners open links and would otherwise use up the one-time token.
 */
export default async function AuthConfirmPage({ params, searchParams }: PageProps<"/[locale]/auth/confirm">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, query] = await Promise.all([getTranslations("AuthConfirm"), searchParams]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const tokenHash = one(query.token_hash);
  const type = one(query.type);
  const next = safeNextPath(one(query.next), localizedPath("/home", locale, routing.defaultLocale));
  const valid = tokenHash.length > 0 && isSignInAction(type);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-12 pb-10">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      <PaperCard>
        {valid ? (
          <form action="/api/auth/confirm" method="post" className="flex flex-col gap-4 pt-2">
            <p>{t("body")}</p>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="h-12 w-full rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press">
              {t("button")}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            <p>{t("invalid")}</p>
            <Link href={{ pathname: "/auth", query: { next } }} className="font-semibold text-brand underline-offset-4 hover:underline">
              {t("back")}
            </Link>
          </div>
        )}
      </PaperCard>
    </main>
  );
}
