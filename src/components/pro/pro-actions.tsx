"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { PlanPrice, ProPlan, ProState } from "@/core/billing";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const POLL_MS = 2000;
const POLL_FOR_MS = 60_000;

/**
 * The plans and the buttons: Checkout for a plan, the Customer Portal once Pro. Back from Checkout, it waits for
 * the webhook (polling the status) instead of trusting the redirect. While Pro isn't on sale (`state.available` is
 * false: the beta, ADR 0055) the plans show the planned prices and the buttons are greyed out.
 */
export function ProActions({ state, prices, signedIn, checkout }: { state: ProState; prices: PlanPrice[]; signedIn: boolean; checkout: boolean }) {
  const t = useTranslations("Pro");
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState<ProPlan | "portal" | null>(null);
  const [error, setError] = useState(false);
  const [waiting, setWaiting] = useState(checkout && !state.pro);

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      const res = await fetch("/api/billing/status").catch(() => null);
      const now = res?.ok ? ((await res.json()) as ProState) : null;
      if (now?.pro) {
        clearInterval(timer);
        setWaiting(false);
        router.replace("/pro");
        router.refresh();
      } else if (Date.now() - started > POLL_FOR_MS) {
        clearInterval(timer);
        setWaiting(false);
        setError(true);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, router]);

  async function go(target: ProPlan | "portal") {
    setBusy(target);
    setError(false);
    try {
      const res = await fetch(target === "portal" ? "/api/billing/portal" : "/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target === "portal" ? {} : { plan: target }),
      });
      if (!res.ok) throw new Error(String(res.status));
      window.location.assign(((await res.json()) as { url: string }).url);
    } catch {
      setBusy(null);
      setError(true);
    }
  }

  const day = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long" });
  const monthly = prices.find((p) => p.plan === "monthly");
  const yearly = prices.find((p) => p.plan === "yearly");
  const saving = monthly && yearly && yearly.currency === monthly.currency ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : 0;

  if (waiting) {
    return (
      <p role="status" className="rounded-2xl bg-brand-soft/60 p-5 text-center font-hand text-2xl">
        {t("unlocking")}
      </p>
    );
  }

  if (state.pro) {
    return (
      <section className="flex flex-col items-start gap-4 rounded-3xl border-2 border-dashed border-brand/50 p-6">
        <p className="-rotate-2 font-display text-2xl font-extrabold">{t("youArePro")}</p>
        {state.renewsAt && (
          <p className="text-sm text-muted-foreground">{state.cancelAtPeriodEnd ? t("endsOn", { date: day(state.renewsAt) }) : t("renewsOn", { date: day(state.renewsAt) })}</p>
        )}
        <button
          type="button"
          onClick={() => go("portal")}
          disabled={busy !== null}
          className="h-11 rounded-full px-5 font-semibold ring-1 ring-border hover:bg-muted disabled:opacity-60 press"
        >
          {busy === "portal" ? t("opening") : t("manage")}
        </button>
        <p role="alert" className="min-h-5 text-sm text-destructive">
          {error && t("error")}
        </p>
      </section>
    );
  }

  const onSale = state.available;

  return (
    <section className="flex flex-col gap-4">
      {!onSale && (
        <div className="flex flex-col gap-1 rounded-2xl border-2 border-dashed border-brand/50 bg-brand-soft/40 p-4">
          <p className="font-display font-bold">{t("notOnSaleTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("notOnSaleBody")}</p>
        </div>
      )}
      {checkout && error && (
        <p role="alert" className="text-sm text-muted-foreground">
          {t("slowWebhook")}
        </p>
      )}
      {prices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pricesUnavailable")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {prices.map((p) => (
            <div
              key={p.plan}
              className={cn("relative flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border", p.plan === "yearly" && "ring-2 ring-brand")}
            >
              {p.plan === "yearly" && saving > 0 && (
                <span className="absolute -top-3 right-4 rotate-3 rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground">{t("save", { percent: saving })}</span>
              )}
              <p className="text-sm font-semibold text-muted-foreground">{t("plan", { plan: p.plan })}</p>
              <p className="font-display text-3xl font-extrabold">
                {t("price", { price: format.number(p.amount, { style: "currency", currency: p.currency }), plan: p.plan })}
              </p>
              {!onSale ? (
                <button
                  type="button"
                  disabled
                  className="mt-auto h-12 cursor-not-allowed rounded-2xl bg-muted px-5 font-bold text-muted-foreground ring-1 ring-border"
                >
                  {t("notOnSale")}
                </button>
              ) : signedIn ? (
                <button
                  type="button"
                  onClick={() => go(p.plan)}
                  disabled={busy !== null}
                  className="mt-auto h-12 rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press"
                >
                  {busy === p.plan ? t("opening") : t("choose", { plan: p.plan })}
                </button>
              ) : (
                <Link
                  href={{ pathname: "/auth", query: { next: "/pro" } }}
                  className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
                >
                  {t("signInFirst")}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
      <p role="alert" className="min-h-5 text-sm text-destructive">
        {error && !checkout && t("error")}
      </p>
      <p className="text-xs text-muted-foreground">{onSale ? t("fineprint") : t("plannedFineprint")}</p>
    </section>
  );
}
