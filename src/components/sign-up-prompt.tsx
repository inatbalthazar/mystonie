import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The way in for visitors (ADR 0071): under the card maker on the landing page, and after a card is shared or
 * downloaded. Shown by CSS while signed out (`signed-out:`), so the page stays static. Sign-up and sign-in are the
 * same step on /auth, with a social account or an emailed code.
 */
export function SignUpPrompt({
  placement,
  className,
}: {
  placement: "home" | "after_card";
  className?: string;
}) {
  const t = useTranslations("SignUp");
  return (
    <section
      className={cn(
        "hidden flex-col gap-4 rounded-3xl bg-brand-soft p-5 signed-out:flex",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Image
          src="/icon.svg"
          alt=""
          width={40}
          height={40}
          unoptimized
          className="shrink-0"
        />
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg leading-snug font-bold tracking-[-0.01em]">
            {t(placement === "after_card" ? "headingAfterCard" : "heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
        </div>
      </div>
      <Link
        href="/auth"
        className="flex h-12 items-center justify-center rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 press"
      >
        {t("cta")}
      </Link>
      <p className="text-center text-sm text-muted-foreground">
        {t.rich("signIn", {
          link: (chunks) => (
            <Link
              href="/auth"
              className="font-semibold text-brand underline-offset-4 hover:underline"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </section>
  );
}
