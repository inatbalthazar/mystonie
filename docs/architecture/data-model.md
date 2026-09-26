# Data model (draft)

Postgres on Supabase. This is a draft. The source of truth becomes `supabase/migrations/`, so update this file in the same change as any migration.

## Conventions
- `uuid` primary keys. User-written tables use **client-generated UUID v7**.
- User-written tables have `created_at`, `updated_at` (server-stamped by trigger) and `deleted_at` (soft delete).
- All timestamps are `timestamptz` (UTC).
- Tables are `snake_case` and plural. **RLS on every table.** "Owner" means `user_id = auth.uid()`.

## Stage 0

| Table | Columns | RLS |
|---|---|---|
| `titles` | `id`, `kind` (`movie`/`series`; later `book`/`manga`), `source` (`tmdb`; later `google_books`/`anilist`), `external_id`, `name`, `original_name`, `original_language`, `year`, `poster_path`, `palette jsonb`, `genres text[]`, `runtime_min`, `episode_count`, `season_count`, `raw jsonb`, `fetched_at`, `created_at`, `updated_at` | Read: everyone. Write: server only. Unique (`source`, `kind`, `external_id`): TMDB movie and TV ids overlap ([ADR 0012](../decisions/0012-catalog-api-caching-and-limits.md)). `runtime_min` is the typical episode runtime for a series. |
| `waitlist` | `id`, `email` unique, `locale`, `source` (utm / `ref`), `consent_at`, `unsubscribed_at`, `created_at`, `updated_at`. Email stored lower-cased. | Insert via our route handler only (honeypot + rate limit). Read: server only. |
| `rate_limits` | `key` (e.g. `search:<ip-hash>`), `window_start`, `count` | Server only. Fixed windows via `rate_limit_hit(key, window_seconds, max)` (returns false when over the limit); `rate_limits_prune()` drops windows older than a day. Not executable by `anon`/`authenticated`. |

Implemented in `supabase/migrations/20260926000000_stage0_titles_waitlist.sql` (+ `20260926102038_titles_unique_per_kind.sql`), tested in `supabase/tests/database/stage0.test.sql`. TypeScript types are generated into `src/data/database.types.ts` with `pnpm db:types`. `set_updated_at()` is the shared trigger for every table with `updated_at`.

## Stage 1

| Table | Columns | RLS |
|---|---|---|
| `profiles` | `id` (= auth.users.id), `username` unique, `display_name`, `avatar_url`, `locale` (default `en`), `time_zone`, `country`, `visibility` (`public`/`private`, default public), `theme` | Owner RW. Public profiles are readable by all. |
| `entries` | `id`, `user_id`, `title_id`, `status` (`want`/`watching`/`finished`), `finished_at`, `rating` (0.5–5), `review` (≤ 280), + sync columns | Owner RW. Others read if owner is public. Unique (`user_id`, `title_id`) where not deleted. |
| `episode_logs` | `id`, `user_id`, `title_id`, `season`, `episode`, `runtime_min`, `watched_at`, + sync columns | Same as entries. Unique (`user_id`, `title_id`, `season`, `episode`) where not deleted. |
| `title_episodes` | `title_id`, `season`, `episode`, `name`, `runtime_min`, `air_date` | Read all. Server writes (TMDB cache). |
| `cards` | `id`, `user_id`, `entry_id` / `episode_log_id` / null (recap), `kind` (`finish`/`progress`/`sticker`/`weekly_recap`/…), `template_id`, `size`, `params jsonb`, `image_path`, `shared_at` | Owner RW. Anyone can read a card with `shared_at` not null (card links). |
| `reports` | `id`, `reporter_id` (nullable), `target_kind` (`profile`/`card`), `target_id`, `reason`, `note`, `created_at`, `resolved_at` | Insert: anyone via route handler (rate-limited). Read: server only. |
| `weekly_recaps` | `id`, `user_id`, `week_start` (local date), `stats jsonb`, `card_id`, `notified_at` | Owner reads. Server writes. |

## Stage 2

| Table | Columns | RLS |
|---|---|---|
| `titles.dtdd_id` (+ `dtdd_matched_at`) | DTDD match | – |
| `title_warnings` | `title_id`, `topic_id`, `topic_name`, `category`, `yes_count`, `no_count`, `fetched_at` | Read all. Server writes. |
| `user_avoid_topics` | `user_id`, `topic_id` | Owner RW. |
| `subscriptions` | `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `price_id`, `current_period_end` | Owner reads. Server (webhook) writes. |
| `title_providers` (or cached jsonb on `titles`) | `title_id`, `country`, `providers jsonb`, `fetched_at` | Read all. Server writes. |
| `import_jobs`, `import_rows` | Letterboxd import preview/commit | Owner reads. Server writes. |
| Reading progress | `progress_logs` or extension of `episode_logs` for chapters/volumes (decide via ADR) | Same as entries. |

## Later
Designs for follows, kudos, community warnings + votes, quiz, XP/Gem ledgers, wheel, store and ads are in [product/later/](../product/later/README.md). Keep the day-one conventions above so they slot in without rewrites.
