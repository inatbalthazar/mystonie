import { cn } from "@/lib/utils";

/** A small round profile photo, or the name's first letter on the brand tint. */
export function Avatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- the profile photo: a 320 px square from our storage (or an older provider link)
      <img src={url} alt="" width={40} height={40} referrerPolicy="no-referrer" className={cn("size-10 shrink-0 rounded-full object-cover ring-1 ring-border", className)} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-extrabold text-brand uppercase", className)}
    >
      {[...name][0]}
    </span>
  );
}
