import type { Block } from "@/core/journal";
import { ArticleBlocks } from "./article-blocks";
import { TitleEmbed } from "./title-embed";

/** A Journal article's blocks (`parseJournal`) as the page: reading-sized text, taped-in title cards. */
export function ArticleBody({ blocks }: { blocks: readonly Block[] }) {
  return <ArticleBlocks blocks={blocks} title={(b, index) => <TitleEmbed kind={b.kind} externalId={b.externalId} label={b.label} index={index} />} />;
}
