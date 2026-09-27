-- "Share stats" cards from the stats page (S1 stats, ADR 0026): a new card kind, `stats`. Like a weekly
-- recap card it has no entry or episode log; its params hold the period's numbers (`recap.period` set).

alter table public.cards drop constraint cards_kind_check;
alter table public.cards add constraint cards_kind_check
  check (kind in ('finish', 'progress', 'sticker', 'weekly_recap', 'stats'));

alter table public.cards drop constraint cards_recap_has_no_source;
alter table public.cards add constraint cards_recap_has_no_source
  check (kind not in ('weekly_recap', 'stats') or num_nonnulls(entry_id, episode_log_id) = 0);
