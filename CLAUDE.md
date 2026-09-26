# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The shared agent instructions live in AGENTS.md so every agent reads the same rules:

@AGENTS.md

## Claude Code specifics
- `/next-task` (in `.claude/commands/`) picks up the next unchecked roadmap task in the current stage and runs the workflow above.
- The owner writes in Thai. Reply in Thai unless asked otherwise. Product UI copy is always English-first.
- For Supabase, prefer the local CLI stack (`supabase start`) over applying migrations to the remote project through MCP. Only touch the remote project when the owner asks.
- For any Claude API work (future AI features), load the `claude-api` skill first.
- For card or UI design work, follow [docs/design/design-direction.md](docs/design/design-direction.md).
