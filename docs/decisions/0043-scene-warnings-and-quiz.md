# ADR 0043: Scene warnings and the warnings quiz: our own topics mapped to DTDD's, statuses and quiz rules in the database, no DTDD seeding, no rewards

**Status:** Accepted · **Date:** 2026-09-30

## Context
The stage 3 task "our own timestamped warnings (S02E05 · 00:41) with votes, and the warnings quiz (no Gems)" ([S3 warnings & quiz](../product/features/S3-warnings-quiz.md)) builds the old designs in [later: crowdsourced warnings](../product/later/crowdsourced-warnings.md) and [later: quiz](../product/later/quiz.md).

Three things were already true:
- Content warnings come from DoesTheDogDie ([ADR 0009](0009-content-warnings-from-dtdd-first.md), [ADR 0035](0035-content-warnings-cache-and-survived.md)). DTDD has yes/no votes per topic, but nothing per scene.
- Users' avoid-topics are stored as DTDD topic ids (`user_avoid_topics`).
- DTDD's API terms allow caching **only to improve performance**, ask for everything to be deleted if we stop using the API, and forbid bulk harvesting.

The Gem economy stays gated ([ADR 0036](0036-expansion-features-before-launch.md)), so the quiz can't pay out.

## Decision
**Topics: a small catalogue of our own, each mapped to a DTDD topic.**
- 26 topics that people skip scenes for (a dog dies, spiders, jump scares, flashing lights, blood and gore, needles, gun violence, sexual assault, suicide, self-harm, sex scenes, drug use, …), in five groups. Each carries its DTDD topic id, so the avoid-topics people already chose flag our warnings too.
- They live in the `warning_topics` table (data: foreign keys, retire with `active = false`), mirrored in `src/core/scene-warnings.ts`. Names and quiz questions are translations (`WarningTopics`), in Thai too; our names replace DTDD's English ones in badges.
- 13 are asked in the quiz. Screen-only ones (jump scares, flashing lights, loud noises) aren't offered for books and manga.
- Rejected: DTDD's whole list (~290 topics). It's English only, too long to pick from in a sheet, and many topics aren't about a scene.
- Rejected: topics unrelated to DTDD's. People would need a second avoid list.

**Nothing from DTDD goes into our data.** Our warnings start empty and grow from our users only. Seeding them from DTDD's votes would be keeping its data beyond a performance cache, which its terms don't allow. DTDD stays the title-level source; ours adds where.

**Scene warnings (`scene_warnings`, `scene_warning_votes`), and the database decides.**
- A warning is a topic plus an optional place:
  - a series' season and episode;
  - a start and end time in seconds (movies and episodes);
  - a book's chapter or page, a manga's chapter or volume.

  The insert trigger checks the place and topic against the title's kind, starts the warning as pending with its adder's confirmation (whatever was sent), and allows 30 a day per person. The same warning twice by the same person is refused (a unique index).
- **Adding and voting** need a live entry that is **watching or finished** (`private.can_warn`, in RLS), and nobody votes on their own.
  - Rejected: finished only. Noting the scene you just watched mid-series is the main use.
  - Rejected: requiring that episode to be logged. Too much friction for a note.
- **The status** is written only by the votes trigger (`private.tally_scene_warning`). It locks the warning, recounts the live votes and applies the rule:
  - **confirmed:** at least 5 confirmations (the adder counts) and more than disputes;
  - **disputed:** at least 5 disputes and at least as many as confirmations;
  - pending otherwise.

  Clients have no column grant on `status`, `confirms` or `disputes`. The old design's "verified" is called "confirmed" here, as the UI says it.
- Rejected: needing 5 confirmations besides the adder. With few users, warnings would wait for months.
- **Disputed warnings** are hidden from everyone but their adder. A confirmed one can't be withdrawn: others rely on it.
- **No free-text notes.** Structured topics and places are what people need to skip a scene, and they need no moderation. The old design's note field and reporting a warning are left out.
- **Privacy:**
  - others read warnings only through security definer functions (`title_scene_warnings`, `scene_warning_tally`, `community_avoid_hits`), which return what was noted and the totals, never who;
  - the tables' RLS lets people read only their own rows;
  - deleting an account deletes its votes, and the warnings they supported are recounted;
  - its warnings stay, with `user_id` set to null. This is the one user table that doesn't cascade: the warning is about a title, not about the person, and others confirmed it.

**The quiz: two kinds of question, served and timed by the database.**
- Security definer functions called as the signed-in user: `quiz_next(p_title_id)` and `quiz_answer(p_id, p_choice)`, returning JSON that `src/core/quiz.ts` checks.
  - Serving a question writes a `quiz_answers` row with `served_at`. The answer is timed against it: the server's clock, never the client's.
  - The route handlers add the usual per-IP rate limit.
  - Rejected: service-role-only functions. The quiz would need the service key to run, and RLS plus the functions already bind every write to `auth.uid()`.
- **Questions only from finished titles.** Order:
  1. the unanswered one served last;
  2. **someone else's waiting warning** (the answer is a vote: yes confirms, no disputes);
  3. an open question closest to settled;
  4. a new (title, topic) question. Topics with a confirmed warning for the title are skipped.

  Warnings come first because the quiz exists to improve the warnings' data. `p_title_id` (from a title page) is tried first.
- **Settling:** a topic question settles after **10 counted answers**. The side with at least 5 and more than the other wins; 5–5 is **contested**. This is the rule decided in the open questions. A question settled "yes" flags the title like a confirmed warning.
- **Speed rule:** an answer under 1.5 s after serving isn't counted. The third within 10 minutes pauses the quiz for an hour (`quiz_pauses`). "Don't remember" is recorded and not counted. Unique indexes make "never the same question twice" structural.
  - The page waits 1.5 s before its buttons work, so honest answers always count.
- **No rewards.** The old design's Gems, the 5-a-day earning cap and the ledger are left out; the Gem economy needs the owner's go.
  - Rejected for now: a "helper" sticker (added later: Lookout and Guardian, [ADR 0063](0063-more-stickers.md)). The badge catalogue is about what people finish. A badge for answers can come later without schema changes (the answers are recorded).

**Badges from both sources.** `avoidBadges` merges DTDD's cached Yes votes (`avoid_warnings`) with `community_avoid_hits` (confirmed warnings, settled yes answers).
- Badge topics now carry the DTDD id (`BadgeTopic`), so the UI names our topics in the viewer's language.
- `/api/warnings/badges` and the collection cover every kind of title, since our warnings cover books and manga.

**Settings → Content warnings** falls back to our 26 topics when DTDD's list can't be loaded. Their ids are DTDD's, so the saved choices are the same.

**Online only.** Adding, voting and the quiz need the server (it checks, counts and times them), so they don't go through the offline outbox ([ADR 0042](0042-offline-first.md)).

## Consequences
- The remote project needs `20261007090000_stage3_scene_warnings_quiz.sql` (after the other stage 3 migrations), when the owner says so.
- **Adding a topic** takes a migration (a `warning_topics` row) and its words in `messages/*.json`, released together. The app hides questions and warnings whose topic it has no words for.
- **New warnings wait for people:** with few users, most stay "Needs confirmation" for a while. They show, labelled, so the first viewers still benefit. The threshold is one SQL function (`private.scene_warning_status`) and one constant (`SCENE_CONFIRMATIONS`).
- **If DTDD is dropped,** `title_warnings` is emptied (ADR 0035), and our warnings, topics and badges keep working.
- The Privacy Policy says what's stored and that others see only the warnings and totals. The account export includes warnings, votes and quiz answers.
