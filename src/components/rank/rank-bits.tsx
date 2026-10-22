"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { RankItem } from "@/core/rankings";
import { cn } from "@/lib/utils";

/** A thing on the list, small: its poster, or a place's code (JP, TH-50) or a title's first letter on grey. */
export function Thumb({ item, className }: { item: RankItem; className?: string }) {
  const place = item.kind === "country" || item.kind === "region";
  return (
    <span className={cn("relative flex aspect-[2/3] w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-black/5", className)}>
      {item.posterUrl ? (
        <Image src={item.posterUrl} alt="" fill unoptimized sizes="44px" draggable={false} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="px-0.5 text-center font-display text-xs font-extrabold break-all text-muted-foreground">
          {place ? item.ref.split(":")[1] : item.name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}

export function IconButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30", className)}
    >
      {children}
    </button>
  );
}
