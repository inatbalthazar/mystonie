# S3 · Scene warnings and the warnings quiz

**Stage:** 3 · **Built:** [ADR 0043](../../decisions/0043-scene-warnings-and-quiz.md) · From [later: crowdsourced warnings](../later/crowdsourced-warnings.md) and [later: quiz](../later/quiz.md) · Builds on [S2 content warnings](S2-content-warnings.md) (DoesTheDogDie)

## Summary
DoesTheDogDie says *whether* a title has something ("a dog dies: yes"). Mystonie's own warnings say **where**, so people can skip it.
- People who watched, read or played a title add **scene warnings**: what happens and where. For example "a dog dies · S2 · E5 · 41:10–42:30", "jump scares · 1:02:13" or "self-harm · Chapter 12".
- Others who saw it **confirm** ("Saw it") or **dispute** ("Not there"). A warning is **confirmed** once 5 people saw it.
- The **warnings quiz** asks people quick questions about titles they finished, such as "Does a dog die in *Up*?", or asks them to confirm someone's warning. After 10 answers a question is settled.
- Confirmed warnings and settled "yes" answers **flag titles** for the topics people avoid, next to DTDD's votes, on every kind of title (books, manga and games too).
- **No Gems:** the quiz rewards nothing. The Gem economy stays gated ([ADR 0036](../../decisions/0036-expansion-features-before-launch.md)).

## Rules
### Topics
- **26 topics** in five groups: animals, scares and senses, body, violence, heavy themes. Examples: a dog dies, spiders, jump scares, flashing lights, blood and gore, needles, gun violence, sexual assault, suicide, self-harm, sex scenes, drug use.
- **Each topic is also a DoesTheDogDie topic.** So the avoid-topics people pick in Settings (DTDD ids) flag our warnings too, with no second list to choose from.
- **Screen-only topics** (jump scares, flashing lights, sudden loud noises) are offered only for movies, series and games.
- **Topics are data:** the `warning_topics` table. `active = false` retires one without touching its warnings. Names and quiz questions are translations in the app (`WarningTopics` in `messages/*.json`), so a new topic needs words in the app before the database lists it. Code: `src/core/scene-warnings.ts`.
- **Names are translated** (Thai too). Our topics' names replace DTDD's English ones in badges.

### Adding a scene warning
- **Who:** someone whose collection has the title as **watching** (reading, playing) or **finished**. Anyone else sees "Mark it as watching or finished to add warnings and confirm them."
- **What and where**, in a sheet on the title page ("Add a scene warning"):
  - **what happens:** a topic, grouped;
  - **where**, optional:
    - a series: season and episode (starting on the furthest episode logged), or "Throughout";
    - a time into the movie or episode: from and to, typed like a video player shows it (`41:10`, `1:02:13`);
    - a book: chapter or page; a manga: chapter or volume;
    - a game: nowhere. A game's warning is about the whole game, because a game has no fixed timeline ([S3 games](S3-games.md)).
- **Someone already noted it?** When others' warnings have the same topic at the same episode (on a movie, anywhere), the sheet offers them first: "If it's the same scene, confirm theirs instead", with "That's the one". Votes then gather on one warning instead of spreading over near-copies.
- **Limits:**
  - the same warning twice (same topic and place) is refused;
  - at most 30 a day per person (the database), and 30 per 10 minutes per IP (the route).
- **No free-text notes:** there's nothing to moderate, and nobody's words reach anyone else.
- **Withdrawing:** the adder can withdraw a warning while it waits. Once confirmed it stays, because others rely on it.

### Confirming
- **Who:** anyone with the title as watching or finished, except the warning's adder.
- **One vote per person:** "Saw it" (confirm) or "Not there" (dispute). Tapping the same one again takes the vote back; the other one changes it.
- **The rule** (the database's alone; a client can't set a status or a count):
  - **confirmed:** at least 5 confirmations and more confirmations than disputes. The adder counts as the first confirmation.
  - **disputed:** at least 5 disputes and at least as many as confirmations.
  - **pending** otherwise ("Needs confirmation · 2 of 5").
- **The status follows the votes:** a confirmed warning goes back to pending if confirmations are taken back, and a disputed one comes back if people confirm it.
- **Disputed warnings** leave everyone's list except their adder's ("Others didn't see this").
- **Privacy:** nobody sees who added a warning or who voted, only what was noted and the totals.
- Deleting an account deletes its votes (the warnings are recounted) and keeps the warnings it added, without the account.

### The title page
- **Every kind of title** has a **Scene warnings** block. On movies and series it comes after DTDD's "Content warnings" block. For books, manga and games it's the only warnings block.
- **The block:**
  - a short intro ("…noted by people who watched it, so you can skip ahead. A warning is confirmed once 5 people saw it.");
  - the warnings in viewing order: "Throughout" first, then by episode, chapter or page, then time;
  - each warning: the topic, where, and a stamp (Confirmed by N) or "Needs confirmation · N of 5";
  - the viewer's buttons: Saw it / Not there, or "Added by you" · Withdraw;
  - "Add a warning".
- **The viewer's avoid-topics** are highlighted ("One of your topics"). A confirmed one puts a "Heads up" stamp on the block.
- **People who finished it say:** the quiz's settled answers for the title (Yes / No / They disagree, with the counts).
- **"Quiz me about this one"** (someone who finished it): the quiz, asking about this title first.

### Badges
- A title is flagged for an avoided topic when **DTDD says yes** (S2, cached data), or **our data says yes**: a confirmed scene warning, or a quiz question settled "yes".
- This works for every kind of title: in the collection (tiles and rows), in quick-add search results, and on the page.
- Our topics are named in the viewer's language; other DTDD topics keep DTDD's name.

### The warnings quiz (`/quiz`)
- **Questions come only from titles the user finished.** In this order:
  1. the question served last and not answered yet (a reload shows it again);
  2. a warning someone else added to one of those titles and that is still waiting, closest to confirmed first: "Someone who watched *X* noted this: a dog dies · S2 · E5 · 41:10. Did you see it?";
  3. a question others already answered about one of those titles, closest to settled first (so questions settle);
  4. a new question: a finished title and a quiz topic nobody has asked about for it yet. There are 13 quiz topics, and a topic that already has a confirmed warning for the title is skipped.
- **`?title=`** (from a title page) asks about that title first, then anything else.
- **Answers:** Yes · No · Don't remember.
  - An answer to a warning is a vote on it (yes confirms, no disputes).
  - "Don't remember" is kept but counts for nothing.
  - **Nobody is asked the same question twice.**
- **Settling a question:** after **10 counted answers**, the side with at least 5 and more than the other wins (6–4 is a yes). 5–5 is **contested** ("They disagree"). Settled questions aren't asked again. An answer that arrives after a question settled is kept but not counted.
- **Speed rule (the server's clock):** an answer under **1.5 s** after the question was served counts for nothing ("Take a moment to read each question: that answer didn't count."). The **third** such answer within 10 minutes **pauses the quiz for an hour** ("The quiz is taking a break… paused until 15:42").
  - The page's buttons wake up only after 1.5 s, with a thin bar filling while the question is read, so honest answers always count. The client's timer is only for show.
- **Rate limit:** 120 requests a minute per IP (the routes), on top of the speed rule per person.
- **Empty states:**
  - nothing finished yet: "Finish something first", with a link to the collection;
  - nothing left to ask: "That's everything for now".
- **After an answer:** a short note ("Thanks, that helps.", "That settled it. People who finished X say: yes.", "That confirmed it."), then the next question. A count shows the answers given this visit.
- **Ways in:** a note on Home (for someone who has finished something), the title page ("Quiz me about this one"), and Settings → Content warnings.

### Online only
Adding, voting and the quiz need the network: the server checks them and times them. They don't use the offline outbox ([S3 offline](S3-offline.md)).

### Settings → Content warnings
If DTDD's topic list can't be loaded, our 26 topics stand in, so people can still choose what to avoid. Their ids are DTDD's, so the choices are the same either way.

## Acceptance criteria
- [x] A viewer who watched or read a title adds a warning with where it happens: S/E and a time for a series, a time for a movie, a chapter or page for a book (a chapter or volume for a manga). Someone who hasn't can't. (`e2e/scene-warnings.spec.ts`; the kinds and places in `stage3_scene_warnings_quiz.test.sql`)
- [x] The 5th confirmation (the adder counts) flips a warning to confirmed, and only the database sets a status. (`stage3_scene_warnings_quiz.test.sql`: 4 isn't enough, the 5th confirms it, clients can't send or update a status, no voting on your own. `e2e/scene-warnings.spec.ts`: a vote from the page, then "Confirmed by 5".)
- [x] Confirmed warnings flag titles for the user's avoid-topics, like DTDD's votes. (`e2e/scene-warnings.spec.ts`: a show DTDD knows nothing about is flagged in the collection; `community_avoid_hits` in the pgTAP test.)
- [x] Quiz: a user with no finished titles gets "Finish something first". (`e2e/scene-warnings.spec.ts`, pgTAP)
- [x] Quiz: an answer 0.5 s after serving isn't counted, and the 3rd such answer in 10 minutes pauses the quiz. (pgTAP; `e2e/scene-warnings.spec.ts` answers through the API the instant a question arrives.)
- [x] Quiz: the 10th counted answer at 6 yes / 4 no settles the question as yes; 5 / 5 is contested. (pgTAP)
- [x] Quiz: the same user is never served the same question twice. (pgTAP; the unique indexes on `quiz_answers`)
- [x] Quiz answers to a waiting warning count as confirmations or disputes. (pgTAP)
- [x] No Gems or other rewards. Nothing is sent to DoesTheDogDie, and nothing from DTDD is copied into our warnings (its terms allow caching only for speed).

## Data
- `warning_topics`, `scene_warnings`, `scene_warning_votes`, `quiz_questions`, `quiz_answers`, `quiz_pauses`, and the functions `title_scene_warnings`, `scene_warning_tally`, `quiz_next`, `quiz_answer` and `community_avoid_hits`. See the [data model](../../architecture/data-model.md); migration `20261007090000_stage3_scene_warnings_quiz.sql`.
- Routes (all signed in):
  - `POST /api/scene-warnings`;
  - `PUT /api/scene-warnings/[id]` (vote) and `DELETE /api/scene-warnings/[id]` (withdraw);
  - `GET /api/quiz` and `POST /api/quiz`;
  - `POST /api/warnings/badges` now covers every kind.

  See [external APIs](../../architecture/external-apis.md).
- The account export includes the warnings added, the votes and the quiz answers.

## Not in this task
- Gems or any reward for answering (gated), and a badge for helping (a possible follow-up).
- Free-text notes on warnings, and reporting a warning (nothing to moderate yet).
- Asking the quiz right after a finish in the celebration (the title page link covers it for now).
- Timestamps on DTDD's data (DTDD has none per scene).
