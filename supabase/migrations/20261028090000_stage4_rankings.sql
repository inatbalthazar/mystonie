-- Stage 4, rankings (ADR 0099): a Top 3, 5 or 10 of anything, or a tier list, as a card. A ranking is a card like the
-- Shelf's: its items live in `cards.params` (checked by the app, `parseRanking`), so the only change is the new kinds.
alter table public.cards drop constraint cards_kind_check;
alter table public.cards add constraint cards_kind_check
  check (kind in ('finish', 'progress', 'sticker', 'weekly_recap', 'stats', 'milestone', 'monthly_recap', 'year_review', 'challenge', 'reel', 'atlas', 'shelf', 'ranking', 'tier_list'));
