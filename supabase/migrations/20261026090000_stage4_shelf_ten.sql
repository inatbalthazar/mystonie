-- Stage 4, the Shelf's top ten (ADR 0095): up to 10 pinned favourites (was 4), and a Shelf card to share them, drawn
-- in the browser like every card.

alter table public.profiles drop constraint profiles_shelf_pins_check;
alter table public.profiles add constraint profiles_shelf_pins_check
  check (cardinality(shelf_pins) <= 10 and array_position(shelf_pins, null) is null);

alter table public.cards drop constraint cards_kind_check;
alter table public.cards add constraint cards_kind_check
  check (kind in ('finish', 'progress', 'sticker', 'weekly_recap', 'stats', 'milestone', 'monthly_recap', 'year_review', 'challenge', 'reel', 'atlas', 'shelf'));
