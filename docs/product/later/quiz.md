# F15 · Crowdsourcing quiz

> **Status: BUILT in stage 3, without Gems,** as [S3 warnings & quiz](../features/S3-warnings-quiz.md) ([ADR 0043](../../decisions/0043-scene-warnings-and-quiz.md)). That spec is the source of truth: the quiz rewards nothing (the Gem economy stays gated), so the daily earning cap and the ledger are left out; waiting scene warnings are asked first (the answer is a vote on them); the 10-answer rule, the 1.5 s speed rule and the one-hour pause are as below. Kept for history.

**Phase:** M4 · **Priority:** Core (feeds [F05](crowdsourced-warnings.md) data quality)

## Summary
Turns collecting content-warning data (jumpscares, sex scenes, and so on) into a game. Users answer short questions about titles **they have finished** and earn Gems when their answer agrees with the community.

## Question generation (server)
- Questions are drawn **only from titles the user has marked finished**.
- For a (title, tag) with **no data yet**: ask *"Does [title] contain a [tag]?"* with choices **1. Yes · 2. No · 3. Don't remember**.
- For a (title, tag) that **has data but is not verified**: reuse the **same question** for other users **until 10 users have answered it**.
- Don't ask a user the same question twice.
- "Don't remember" answers are recorded but don't count toward agreement or the 10-answer target.

## Rewards & resolution (server)
- A question stays open until it has **10 counted answers**. It then **resolves** to the side (Yes or No) that has **at least 5 agreeing answers and more than the other side**. Everyone on the winning side gets Gems (amount in config). The other side gets nothing.
- A **5–5 tie** is marked `contested`, which extends collection or sends it to review.
- *Interpretation note:* the original says "reuse until 10 users, reward the side that reaches 5". With two choices, one side always reaches 5 before the 10th answer, so "resolve as soon as a side hits 5" would make the 10 meaningless. We read it as "collect 10, the winner needs ≥ 5". Tracked in [open questions](../../open-questions.md).
- A resolved "Yes" feeds F05 as confirmations for the warning. A resolved "No" is stored as a verified absence ("no pet death").
- Gem payouts go through the ledger with an idempotency key per (question, user).

## Limits & anti-abuse (server, hard rules)
- **Unlimited quizzes**, but only the **first 5 per UTC day** can earn Gems. Later ones still count toward data. *(This resolves the original text, which says both "max 5 per day" and "unlimited but no Gems after 5".)*
- **Speed detection:** the server records `served_at` when a question is issued and `answered_at` on submit. If the elapsed time is **below the minimum (default 1.5 s, config)**, the answer scores nothing, is excluded from counts, and repeated violations (default 3 in 10 min) trigger a **temporary quiz suspension** (default 1 h, config).
- The client timer is display-only. Only server timestamps count.
- Rate limit per user and per IP on the quiz endpoints.

## Acceptance criteria
- [ ] A user with 0 finished titles gets "Finish something first" instead of a quiz.
- [ ] Answer submitted 0.5 s after serving: no score, not counted, and the 3rd such answer suspends the user.
- [ ] 6th gem-eligible quiz on the same UTC day awards 0 Gems but is recorded.
- [ ] The 10th counted answer with 6 Yes / 4 No resolves the question as Yes and credits exactly those 6 users once. 5 / 5 marks it `contested`.
- [ ] Same user is never served the same question twice.

## Data
`quiz_questions` (title_id, tag_id, status open|resolved|contested, resolution), `quiz_answers` (question_id, user_id, choice, served_at, answered_at, counted, rewarded), `quiz_suspensions`, `quiz_daily_counts` (user_id, date_utc, rewarded_count).
