"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { MOVIE_QUOTES } from "@/core/quotes";
import { Link } from "@/i18n/navigation";

// Each quote is written in word by word: when the first word starts, the gap between words, and the word after which
// the rest come together (so a long line doesn't keep people waiting). A cycle (write, stay, fade) is CYCLE_MS,
// matching the `ink` keyframes in globals.css.
const START_MS = 150;
const STAGGER_MS = 70;
const STAGGER_MAX = 12;
const CYCLE_MS = 10_000;
/** Where in the cycle everything has faded (the words by 92%, the movie's line by 91%). */
const GONE_AT = 0.93;

/**
 * The movie lines on Home (ADR 0093): today's quote first, the same for everyone, then a random one after each cycle,
 * for as long as Home is open. Each quote links to its movie's page. With reduced motion it stays on today's, still.
 */
export function QuoteOfTheDay({ first }: { first: number }) {
  const t = useTranslations("HomeApp");
  const [index, setIndex] = useState(first);
  const quote = MOVIE_QUOTES[index] ?? MOVIE_QUOTES[0]!;
  const words = t("quote", { text: quote.text }).split(" ");
  const penDelay = START_MS + Math.min(words.length, STAGGER_MAX) * STAGGER_MS + 150;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => {
        const next = Math.floor(Math.random() * (MOVIE_QUOTES.length - 1));
        return next >= current ? next + 1 : next;
      });
    }, penDelay + CYCLE_MS * GONE_AT);
    return () => window.clearTimeout(timer);
  }, [index, penDelay]);

  return (
    <Link
      key={index}
      href={`/title/movie/${quote.tmdbId}`}
      aria-label={`${quote.text} ${t("quoteLabel", { movie: quote.movie })}`}
      className="group press -my-1 flex origin-left flex-col gap-1 rounded-lg py-1"
      style={{ ["--pen-delay" as string]: `${penDelay}ms` }}
    >
      <span aria-hidden="true" className="font-hand text-2xl leading-tight text-muted-foreground transition-colors group-hover:text-foreground">
        {words.map((word, i) => (
          <span key={i}>
            <span className="quote-word" style={{ ["--ink-delay" as string]: `${START_MS + Math.min(i, STAGGER_MAX) * STAGGER_MS}ms` }}>
              {word}
            </span>
            {i < words.length - 1 && " "}
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="quote-from relative w-fit pb-1.5 text-xs text-muted-foreground/80">
        {t("quoteFrom", { movie: quote.movie, year: quote.year })}
        <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="quote-pen absolute inset-x-0 bottom-0 h-1.5 w-full text-brand">
          <path
            d="M1 4 C 18 1, 30 5.5, 50 3 S 82 1.5, 99 3.5"
            pathLength="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    </Link>
  );
}
