import type { ReactNode } from "react";
import { PageTransition } from "@/components/motion/page-transition";

/** Every page slides in the direction you went (ADR 0070): this remounts when the first segment changes; the templates under it do the same for their own pages. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
