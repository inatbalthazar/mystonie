# ADR 0021: Collection tables enforce the day-one rules in the database

**Status:** Accepted · **Date:** 2026-09-27

## Context
Stage 1 adds the user tables `entries`, `episode_logs` and `cards`, plus the TMDB episode cache `title_episodes` ([data model](../architecture/data-model.md)). Browsers write these rows directly through Supabase (RLS), so any rule enforced only in our code can be broken by a hand-made request. The rules in question:
- the day-one rules: client UUID v7, server `updated_at`, soft delete;
- one live entry per title;
- a card may only point at its owner's rows;
- privacy.

## Decision
**The database enforces the rules, not only the app.**
- **UUID v7:**
  - Every user-table id has `check (uuid_extract_version(id) = 7)` (Postgres 17), and there is no default.
  - Ids come from `uuidv7()` in `src/core/ids.ts`, a 20-line generator with tests. Rejected: the `uuid` package, a new dependency for one function.
- **Soft delete and server-owned columns:**
  - Clients get no `DELETE` privilege.
  - Column grants limit `UPDATE` to the editable fields plus `deleted_at`. `id`, `user_id`, `title_id` and the timestamps can't be changed.
  - The service role keeps full access, and account deletion still removes everything by cascade from `profiles(id)` ([ADR 0020](0020-auth-passwordless-ssr.md)).
- **Card ownership uses composite foreign keys.** `(entry_id, user_id)` references `entries (id, user_id)`, and the same holds for episode logs, so a card can't reference someone else's entry, even from the server.
  - Rejected, an `exists (…)` check inside the RLS policy: it only guards client writes.
  - `image_path` must be `<user_id>/<card id>.png`, so clients may set it without pointing at another user's file.
- **Status consistency:** `finished_at` is set exactly when `status = 'finished'`, so stats can count finishes by date without special cases.
- **Visibility:**
  - Owners read all their rows, including soft-deleted ones (future sync needs the tombstones).
  - Others (signed in or not) read live `entries` and `episode_logs` of **public** profiles directly through RLS.
  - A card is readable by anyone once `shared_at` is set, even for a private profile: sharing is an explicit publish ([S1 profile](../product/features/S1-profile-privacy.md)).
  - The policies check visibility with `private.is_public_profile(uid)`, a `security definer` function in a schema the API doesn't expose. It exists because `profiles` is owner-only. Rejected, a public read policy on `profiles`: that would expose time zone and locale.

## Consequences
- App code must create ids with `uuidv7()`, set `finished_at` together with `status`, and remove rows by setting `deleted_at`. It must filter `deleted_at is null` in owner queries.
- A future offline-sync upsert that "merges on conflict" (see [offline-sync](../architecture/offline-sync.md)) needs a server-side function, because clients can't update `id`, `user_id` or `title_id`.
- New card kinds (milestone, monthly recap, year in review, survived) need a migration that widens the `kind` check. New sizes need one too.
- `title_episodes` is written only by the service role (route handlers), like `titles`.
- Tests: `supabase/tests/database/stage1_collection.test.sql`.
