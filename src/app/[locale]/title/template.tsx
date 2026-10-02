import type { ReactNode } from "react";
import { PageTransition } from "@/components/motion/page-transition";

/** Pages under /title slide too when only their own part of the address changes (ADR 0070). */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
