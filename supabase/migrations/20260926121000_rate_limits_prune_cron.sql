-- Delete closed rate-limit windows hourly, so salted IP hashes live at most about a day
-- (promised in the Privacy Policy). pg_cron ships with Supabase.
create extension if not exists pg_cron;

-- Scheduling by name replaces an existing job, so re-running this is safe.
select cron.schedule('rate-limits-prune', '17 * * * *', $$select public.rate_limits_prune()$$);
