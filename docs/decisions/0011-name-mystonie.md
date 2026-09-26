# ADR 0011: Product name Mystonie, mascot Stonie

**Status:** Accepted · **Date:** 2026-09-26

## Context
The working name **Mysto** failed the availability check (open question O1): `mysto.com`, `mysto.app` and `mysto.co` are taken, at least two live store apps are called Mysto (a social/video-chat app and a mystery-box app), and more businesses use it (mysto.us, mysto.shop). It also reads as *mystery/mystic*, not *milestone*.

The owner wanted a name that is short, easy to remember, spell and type, avoids crowded keywords (watch, show, movie, track, log), and fits the product idea: a **collection book** where each finished title is a milestone. The owner also chose a **stone mascot**, a milestone carved like a stone tablet.

Alternatives checked (domains via registrar lookup, web and store search on 2026-09-26):
- Invented short names (Ennro, Kodara, …): available but meaningless.
- "Credits" names (Endcred, Outrocard, …): available but no collection idea.
- Collection names (Seenport, Tixfolio, Stampboo, Pebbook): available, but the owner preferred the stone/milestone direction.
- **Stonie** alone: `.com` taken, existing games *Stonie* and *Stonies* (Upjers), and "stoney" is cannabis slang.
- **Pebbo**: `pebbo.com`/`.app` taken, two live apps. **Pebblog**: `.com` taken, reads as "peb-blog".
- **Mylestory**: sounds like *Milestory*, which three live apps use.

## Decision
- The product is named **Mystonie** ("my stone", from *Milestone*). It keeps the recognisable *Mysto* start.
- The mascot is a round stone character named **Stonie** that "carves" finished titles into the user's collection.
- Domains: `mystonie.com` and `mystonie.app` (both available at decision time). Also buy `mystony.com` to catch typos (`mystoney.com` is taken).
- Handles: `@mystonie` where free (TikTok, X); on IG `@mystonie` belongs to a personal account, so use `@mystonieapp`.
- Card footer: `mystonie · @username`. Tagline: *Finished it? Mystonie it.*

## Consequences
- Code, messages and docs use Mystonie. Earlier ADRs keep the old name as history. The GitHub repo (`inatbalthazar/Mysto`), local folder and Vercel project keep their names until the owner renames them.
- Reserve the usernames `mystonie`, `mysto` and `stonie`.
- Stonie's visuals are part of the designer brief ([design direction](../design/design-direction.md)). The mascot art must steer away from the "stoney" (cannabis) slang reading.
- The owner still needs to buy the domains, claim the handles and run a trademark search (USPTO/WIPO, classes 9 and 42) before the logo is commissioned ([roadmap](../roadmap.md)).
