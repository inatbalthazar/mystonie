# ADR 0049: Revenue plan: tips at launch, then Pro and affiliate links, no banner ads

**Status:** Accepted · **Date:** 2026-09-30

## Context
The owner asked how Mystonie makes money and named three ideas: Buy Me a Coffee, affiliate links and banner ads. Pro is already built and tested ([ADR 0034](0034-pro-subscription.md)) but off. Taking money makes the site commercial, and then the free tiers we rely on stop covering it ([open questions](../open-questions.md) O4, O5, O7): Vercel Hobby is non-commercial (Pro plan ~$20/month), TMDB needs a commercial agreement, DoesTheDogDie's free tier is non-commercial, RAWG's terms disagree with themselves. So revenue has to beat roughly $50–200 a month before it pays for anything.

## Decision
In phases, cheapest first:
1. **At launch: tips only.** A "Buy me a coffee" link ([buymeacoffee.com/inatbalthab](https://buymeacoffee.com/inatbalthab), `SUPPORT_URL` in `src/lib/site.ts`) in the footer of every page and a "Support Mystonie" section in Settings. A tip unlocks nothing (Terms: "Tips"), so the product stays free and the link is no gate. Buy Me a Coffee handles the payment; we store nothing. (Since [ADR 0063](0063-more-stickers.md) its webhook gives the account with the tipper's email the Supporter sticker; still no tip data is kept.) The click is tracked (`support_clicked`).
   - Whether tips alone keep the site non-commercial under Vercel's, TMDB's and DTDD's terms is the owner's check before launch (Vercel's fair-use guidelines have said donations aren't commercial use).
2. **With traction (about 1,000–2,000 monthly users):** the licences in the Pro go-live task, then `PRO_ENABLED=true`. Pro grows with what fans pay for without gating the core loop or sharing: more templates, custom colours and fonts, Year in Review early, a profile badge. Add a **Supporter** tier (a higher yearly price, a badge and a thank-you page), which carries the tip idea into Pro, and **Gift Pro**.
3. **Affiliate links** on book, manga and game pages ([later/affiliate-links.md](../product/later/affiliate-links.md)), labelled and `rel="sponsored"`: books (Amazon Associates, Bookshop.org), manga (BookWalker), games (Humble, Fanatical, GOG; **Steam has no affiliate programme**). Movies and series have little to earn: streaming services rarely pay affiliates.
4. **Later:** printed cards and Year in Review (print on demand, no stock; a new service, so its own ADR), sponsored challenges or reels ([native ads](../product/later/native-ads.md)).

- Rejected: **banner ads.** A niche consumer site earns maybe $1–3 per 1,000 views (10,000 views ≈ $20/month), ad networks need a consent banner the app avoids (cookieless analytics), they slow pages below the Lighthouse ≥ 90 target and clash with the scrapbook look. If ever, only on public pages visitors land on (shared cards), never in the app.

## Consequences
- The footer and Settings carry the tip link from now on; the Terms say what a tip is.
- Rough maths: 2–5 % of users pay; 1,000 monthly users × 3 % × $20/year ≈ $50/month. Pro covers costs from about 5,000 monthly users.
- The roadmap lists the later phases as owner-gated tasks.
