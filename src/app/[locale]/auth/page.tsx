import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { PaperCard } from "@/components/paper-card";
import { localizedPath, safeNextPath } from "@/core/auth";
import { googleSignInEnabled } from "@/data/account";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/** Sign in / sign up (one page for both). `?next=` is where to go afterwards; `?error=link|oauth` explains a failed attempt. */
export default async function AuthPage({ params, searchParams }: PageProps<"/[locale]/auth">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const query = await searchParams;
  const next = safeNextPath(typeof query.next === "string" ? query.next : null, localizedPath("/home", locale, routing.defaultLocale));

  // Already signed in: go straight on.
  const supabase = await userClient();
  const claims = supabase ? (await supabase.auth.getClaims()).data?.claims : null;
  if (claims) redirect(next);

  const [t, google] = await Promise.all([getTranslations("Auth"), googleSignInEnabled()]);
  const error = query.error === "link" || query.error === "oauth" ? query.error : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-12 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-balance">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <PaperCard stamp={t("stamp")}>
        <div className="pt-8">
          <AuthForm next={next} google={google} initialError={error} />
        </div>
      </PaperCard>
    </main>
  );
}
