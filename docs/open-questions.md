# Open questions

Most product questions were **decided on 2026-09-23** (see [brief.th.md §16](brief.th.md) and ADRs 0006–0009). Agents: don't guess on the items below. Use the default and mention it in your PR, or ask the owner. When one is decided, move it into the relevant spec or ADR and delete it here.

## Owner actions (not decisions for agents)
| # | Item | Needed by |
|---|---|---|
| O2 | Launch title for stage 0. | Stage 0 launch |
| O3 | Designer budget cap and hire. | Stage 0 templates |
| O4 | DTDD API key + terms (incl. commercial use). **Key obtained, terms read 2026-09-29** ([external APIs](architecture/external-apis.md)): the free tier is non-commercial only, so the paid Commercial tier is needed before Pro goes live. | Stage 2 warnings |
| O5 | TMDB commercial agreement. | Before Pro |
| O6 | Postal address for the email footer (CAN-SPAM), e.g. a PO box or virtual mailbox ([ADR 0019](decisions/0019-email-resend.md)). | Before the launch email |
| O7 | RAWG's terms for commercial use: its pricing says the free plan is non-commercial ($149/month Business), its API terms say free under 100,000 MAU or 500,000 page views a month ([ADR 0044](decisions/0044-games-rawg.md)). **Key obtained 2026-09-30** (in `.env.local` and Vercel). HowLongToBeat decided 2026-09-30: no scraper, its times only with its permission or a data license. | Game search in production; before Pro |

## Open, with defaults
| # | Question | Default until decided |
|---|---|---|
| Q1 | Re-watches: allow multiple finishes of the same title? | No. One entry per title, but `finished_at` is editable. |
| Q2 | Weekly Recap day and time. | Monday 09:00 in the user's time zone (built this way, [ADR 0025](decisions/0025-weekly-recaps.md)); monthly recaps on the 1st, 09:00 ([ADR 0031](decisions/0031-milestones-monthly-recap-year-in-review.md)). |
| Q4 | DTDD "Yes" threshold. | yes ≥ 3 and yes > no (built this way, `warningVerdict`, [ADR 0035](decisions/0035-content-warnings-cache-and-survived.md)). |
| Q5 | Pro price. | $2.99/mo or $19.99/yr, then run a price test. |
| Q6 | Card link domain / short-link format. | `/c/[id]` on the main domain. |
| Q7 | Which languages after `th`? | Driven by analytics (top visitor locales). |
| Q9 | Bot protection beyond honeypot + rate limit (e.g. Cloudflare Turnstile). | Not until spam shows up. Adding it needs an ADR (new service). |
| Q10 | Follow requests for private profiles? | No. Only public profiles can be followed; going private hides you from every feed ([ADR 0037](decisions/0037-social-follows-stamps-blocks.md)). |
| Q11 | Notify people about new Stamps and followers (push, email)? | No. They show in "Lately" on `/feed` only. Recap notifications stay the only push. |

## Decided (for reference)
**Reading progress: `reading_logs` checkpoints, a sibling of `episode_logs`** (2026-09-27, [ADR 0029](decisions/0029-books-manga-reading-progress.md)) · **Email: Resend** (2026-09-27, [ADR 0019](decisions/0019-email-resend.md)) · **Name: Mystonie, mascot Stonie** (2026-09-26, [ADR 0011](decisions/0011-name-mystonie.md)) · Global English-first (ADR 0007) · **English shown to everyone by default, locale from the URL only, no auto-redirect or locale cookie** (2026-09-26) · **legal operator contact: the owner, `inatbalthazar@gmail.com`, site `https://www.codenat.me/`** (2026-09-26, switch to a brand-domain alias later) · single Next.js app + Supabase (ADR 0006) · browser card rendering (ADR 0008) · DTDD warnings first (ADR 0009) · movies & series first via TMDB · 3 templates Ticket / Polaroid / Bold Stats · no QR on cards · PWA before Expo · Pro subscription before any Gem economy · quiz rule: 10 answers, winning side needs ≥ 5 and a majority (built, [ADR 0043](decisions/0043-scene-warnings-and-quiz.md)) · travel removed from core, then built as the Atlas, country level, private by default (2026-10-01, [ADR 0059](decisions/0059-atlas.md)).
