import Image from "next/image";
import { Fragment, type ReactNode } from "react";
import type { Block, Inline } from "@/core/journal";
import { Link } from "@/i18n/navigation";

function inline(nodes: readonly Inline[], key = ""): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}${i}`;
    switch (n.type) {
      case "text":
        return n.text;
      case "strong":
        return <strong key={k}>{inline(n.children, `${k}.`)}</strong>;
      case "em":
        return <em key={k}>{inline(n.children, `${k}.`)}</em>;
      case "code":
        return (
          <code key={k} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">
            {n.text}
          </code>
        );
      case "link":
        return n.href.startsWith("/") ? (
          <Link key={k} href={n.href} className="font-semibold text-brand underline underline-offset-2">
            {inline(n.children, `${k}.`)}
          </Link>
        ) : (
          <a key={k} href={n.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline underline-offset-2">
            {inline(n.children, `${k}.`)}
          </a>
        );
    }
  });
}

/**
 * Article blocks as reading-sized text, with title cards from `title` (the team's articles; a writer's text has none,
 * ADR 0092). No server-only parts, so the editor's preview uses it too.
 */
export function ArticleBlocks({ blocks, title }: { blocks: readonly Block[]; title?: (block: Extract<Block, { type: "title" }>, index: number) => ReactNode }) {
  let titles = 0;
  return (
    <div className="flex flex-col gap-5 text-[17px] leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 2 ? (
              <h2 key={i} className="mt-3 font-display text-2xl leading-tight font-extrabold tracking-[-0.02em]">
                {inline(b.children)}
              </h2>
            ) : (
              <h3 key={i} className="mt-1 font-display text-xl leading-tight font-bold">
                {inline(b.children)}
              </h3>
            );
          case "paragraph":
            return <p key={i}>{inline(b.children)}</p>;
          case "list": {
            const items = b.items.map((item, j) => <li key={j}>{inline(item)}</li>);
            return b.ordered ? (
              <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-6 marker:font-bold marker:text-brand">
                {items}
              </ol>
            ) : (
              <ul key={i} className="flex list-disc flex-col gap-1.5 pl-6 marker:text-brand">
                {items}
              </ul>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="border-l-4 border-brand/60 pl-4 font-hand text-2xl leading-snug text-muted-foreground">
                {inline(b.children)}
              </blockquote>
            );
          case "rule":
            return <hr key={i} className="my-2 border-dashed border-border" />;
          case "image":
            return (
              <figure key={i} className="flex flex-col gap-2">
                <span className="relative block aspect-[3/2] w-full -rotate-1 overflow-hidden rounded-xl bg-muted shadow-md ring-4 ring-card">
                  <Image src={b.src} alt={b.alt} fill unoptimized sizes="(min-width: 672px) 640px, 100vw" className="object-cover" />
                </span>
                {b.alt && <figcaption className="text-center font-hand text-xl text-muted-foreground">{b.alt}</figcaption>}
              </figure>
            );
          case "title":
            return title ? <Fragment key={i}>{title(b, titles++)}</Fragment> : null;
        }
      })}
    </div>
  );
}
