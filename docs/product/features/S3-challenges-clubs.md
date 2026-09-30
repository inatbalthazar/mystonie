# S3 · Monthly challenges and fandom clubs

**Stage:** 3 · **Built:** [ADR 0040](../../decisions/0040-challenges-and-clubs.md) · From the brief's appendix A ("Monthly Challenge → Challenge + collectible sticker", "Clubs → Fandom Clubs") and its artwork list ("Challenge")

## Summary
Strava's monthly challenges and clubs, for what you finish.
- Every month has four **challenges**. Join one, and everything you finish, watch or read that month counts. Complete it and you get an embroidered **patch** for your album and a **Challenge card**: the month's calendar page with your days circled.
- **Fandom clubs** gather people around a fandom (K-drama, anime, horror, books, games, …). A club page shows its members, what's big with them lately, and their latest finishes.

## Rules
### Challenges
- **Lineup:** each calendar month has a themed challenge, plus three that come back every month.

  | | Challenges |
  |---|---|
  | Every month | Finish Four (finish 4 titles), Twenty Hours (20 hours watching and reading, the recap numbers; play time doesn't count, [S3 games](S3-games.md)), Twelve Days (log something on 12 different days) |
  | Themed | Jan New Chapter (2 books or manga) · Feb Love Stories (3 romances) · Mar World Tour (3 original languages) · Apr Laugh Lines (3 comedies) · May Anime Month (3 anime) · Jun Movie Marathon (5 movies) · Jul Out of This World (3 sci-fi or fantasy) · Aug Box Set (2 series) · Sep Case Files (3 crime or mystery) · Oct Fright Month (3 horror) · Nov K-drama Month (2 Korean series) · Dec Triple Threat (3 kinds of title) |

  Code: `src/core/challenges.ts`. Names are English in every locale, like badges.
- **The month** is the calendar month in the user's time zone. Finishes, episode logs and reading logs from the 1st count, even from before joining.
- **Joining:** only this month's challenges. Leaving is allowed until the challenge is completed. After that the patch is kept for good.
- **Progress and completion** are recorded by the server:
  - after every finish or log (the check that also finds milestones and badges);
  - when joining (joining can complete it at once);
  - when `/challenges` renders.
- **Completing one:**
  - a celebration with the **Challenge card** after the Finish card: "You completed Finish Four!";
  - the Calendar template: the month's page with the days you logged circled, the patch, and the title that completed it; also Bold Stats and the sticker; only the username can be hidden;
  - a Challenge card can be saved only for a challenge you completed.
- **`/challenges`** (signed in):
  - the month and the days left;
  - each challenge on a taped card: patch, what it asks, a progress bar ("3 of 4 titles"), Join / Joined + Leave, "12 joined · 3 completed";
  - the people you follow who joined, with their progress or a check;
  - completed ones: the patch sewn on, the date and "Make the card";
  - **Your patches**: every completed challenge, newest first;
  - a hint about the rules.
- **Home:** "This month's challenges" shows the ones you joined with progress bars, or the lineup as an invitation.
- **Profile:** "Challenge patches" (public, like stickers).

### Fandom clubs
- **Catalogue** (code: `src/core/clubs.ts`): each club is a title filter (kinds, genres, original languages).

  | Club | Titles that count |
  |---|---|
  | K-drama Club | Korean series |
  | Anime Club | Japanese animation, movies and series |
  | Manga Club | Manga (manhwa, webtoons) |
  | Book Club | Books |
| Gamers | Games ([S3 games](S3-games.md)) |
  | C-drama Club | Chinese-language series |
  | Indian Cinema Club | Movies in Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi |
  | Horror, Romance, Sci-fi & Fantasy, Mystery, Comedy, Documentary Clubs | By genre |

- **Joining and leaving:** anyone signed in, any time.
- **`/clubs`** (open to everyone):
  - every club as a felt crest with its tagline and member count;
  - signed in: your clubs first, then the ones your finishes fit best ("12 of your finishes fit"), each with Join.
- **`/clubs/[slug]`** (open to everyone):
  - the crest, the member count, and Join / You're in + Leave (signed out: "Sign in to join");
  - the people you follow who are in it;
  - **Big in the club lately:** titles that fit the club which members finished, watched or read in the last 30 days, once at least 3 members did (private members count, as numbers only);
  - **Latest from members:** the 20 latest finishes of titles that fit the club, by members whose collections are public, as Following feed cards with Stamps (counts only for signed-out visitors).
- **Title pages:** "Clubs for this" shows the clubs the title fits.
- **Profiles:** "Clubs", the clubs the person joined (with "Find your fandom" for the owner).

### Both
- Private and blocked profiles never show; they count only in totals ("12 joined", "3 members"). The Privacy Policy says so.
- The data export includes challenge joins and club memberships.
- The Following feed has tabs to the board, challenges, clubs and find people.
- Analytics: `challenge_joined` (`challenge`), `club_joined` (`club`, `via`), and `card_created` with `card: challenge`.

## Acceptance criteria
- [x] Joining a challenge counts the whole month so far, and the finish that meets the target completes it once, with its Challenge card. (`src/core/challenges.test.ts`, `e2e/challenges-clubs.spec.ts`)
- [x] Clients can't set progress or complete a challenge, can't leave a completed one, and can't save a Challenge card for one they didn't complete. (`stage3_challenges_clubs.test.sql`, `e2e/challenges-clubs.spec.ts`)
- [x] Months and progress follow the user's time zone. (`challenges.test.ts`)
- [x] A club page shows only public, unblocked members' finishes of titles that fit the club; trending needs 3 members; totals count private members without naming them. (`stage3_challenges_clubs.test.sql`, `e2e/challenges-clubs.spec.ts`)
- [x] Joining a club shows it on the profile, and title pages point to their clubs. (`src/core/clubs.test.ts`, `e2e/challenges-clubs.spec.ts`)
- [x] The Calendar card fits every size and hard case. (`/card-lab`, `e2e/cards.spec.ts`)

## Data
`challenge_joins`, `club_members`, the `challenge` card kind, and `challenge_counts()`, `club_counts()`, `club_feed()`, `club_trending()`. See the [data model](../../architecture/data-model.md).

## Not in this task
- User-created challenges or clubs, club chat or discussion, club admins.
- Challenge completions as their own Following feed items, and notifications ("3 days left").
- Late logs for a finished month: a challenge completes only while its month is current.
