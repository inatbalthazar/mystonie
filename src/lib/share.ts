import type { useFormatter } from "next-intl";
import { shareFormat } from "@/core/finish-share";

/** A rare-finish share as text in the user's locale ("0.4%", "<0.01%"), with next-intl's formatter (ADR 0067). */
export function formatShare(format: Pick<ReturnType<typeof useFormatter>, "number">, share: number): string {
  const f = shareFormat(share);
  return (f.under ? "<" : "") + format.number(f.value, f.options);
}
