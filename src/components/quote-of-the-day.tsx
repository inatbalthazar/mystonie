"use client";

import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MOVIE_QUOTES, quoteFitsOneLine } from "@/core/quotes";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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
 * The movie lines on Home's header, with the greeting (ADR 0093): a random quote (the server picks the first, each time Home
 * opens), then another random one after each cycle, for as long as Home is open. Each quote links to its movie's page.
 * Every quote is written at one size. The header is a fixed height (it grows only if a quote needs more than three
 * lines, on a very narrow screen): a one-line quote leaves room for the greeting at its foot; a longer one fades the
 * greeting away and takes its place, so nothing under the header moves. With reduced motion the first one stays, still.
 */
export function QuoteOfTheDay({ first, greeting, longName }: { first: number; greeting: string; longName: boolean }) {
  const t = useTranslations("HomeApp");
  const [index, setIndex] = useState(first);
  const quote = MOVIE_QUOTES[index] ?? MOVIE_QUOTES[0]!;
  const words = t("quote", { text: quote.text }).split(" ");
  const penDelay = START_MS + Math.min(words.length, STAGGER_MAX) * STAGGER_MS + 150;

  // One line or more, measured with the real font and width (the server guesses from the length).
  const [oneLine, setOneLine] = useState(() => quoteFitsOneLine(quote.text));
  const textRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const measure = () => {
      const line = parseFloat(getComputedStyle(text).lineHeight);
      setOneLine(!(line > 0) || text.offsetHeight < line * 1.5);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [index]);

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
    <div className="relative flex min-h-[6.5rem] flex-col">
      <Link
        key={index}
        href={`/title/movie/${quote.tmdbId}`}
        aria-label={`${quote.text} ${t("quoteLabel", { movie: quote.movie })}`}
        className="group press relative z-10 -my-1 flex origin-left flex-col gap-1 rounded-lg py-1"
        style={{ ["--pen-delay" as string]: `${penDelay}ms` }}
      >
        <span
          ref={textRef}
          aria-hidden="true"
          className="font-hand text-2xl leading-tight text-muted-foreground transition-colors group-hover:text-foreground"
        >
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
      <h1
        className={cn(
          "absolute inset-x-0 bottom-0 truncate font-display font-extrabold tracking-[-0.03em] transition-[opacity,translate] duration-500 ease-out",
          longName ? "text-3xl" : "text-4xl",
          !oneLine && "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        {greeting}
      </h1>
    </div>
  );
}
