import { notFound } from "next/navigation";

// Unknown paths render the localized [locale]/not-found.tsx instead of Next's unstyled default.
export default function CatchAll() {
  notFound();
}
