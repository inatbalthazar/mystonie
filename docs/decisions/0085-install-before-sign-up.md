# ADR 0085: Ask visitors to install before they sign up

**Status:** Accepted · **Date:** 2026-10-02 · Extends [ADR 0028](0028-home-pwa-web-push.md) (home screen and web push)

## Context
The owner (2026-10-02) wants Mystonie suggested for the home screen from the website itself, without waiting for sign-up. A modal that pops up is fine.

Until now, only signed-in people were asked: through Home's install card and the getting-started checklist. A visitor who arrived from a shared card never heard that Mystonie works like an app.

Many visitors arrive from Instagram, Facebook, LINE or TikTok. Those apps open links in their own browser, which can't add a page to the home screen.

## Decision
**A sheet for visitors on phones** (`src/components/pwa/install-sheet.tsx`, mounted once in the layout):
- It uses the shared `Sheet`: on a phone it slides up from the bottom and can be dragged away.
- It opens 6 seconds into a visit, so the page is seen first.
- It never opens on top of another open sheet; it waits for that one to close.
- A home-screen mockup with Stonie's icon shows what the visitor gets.

**What it says depends on the browser** (`installWay` in `src/core/install.ts`, pure and tested):

| Way | When | What it shows |
|---|---|---|
| `prompt` | Chromium offered its own dialog (`beforeinstallprompt`) | An **Install** button. If the dialog arrives while the sheet is already open, the steps turn into the button. |
| `ios` | iPhone or iPad | Share, then "Add to Home Screen". |
| `menu` | Other Android browsers, or Chrome before it offers its dialog | The browser's menu, then "Install app" or "Add to Home screen". |
| `in_app` | Instagram, Facebook, Messenger, LINE, TikTok, Snapchat, Pinterest, LinkedIn, X, or an Android webview | Open the page in the phone's browser first. A **Copy the link** button helps. |

**Who is asked:**
- **Visitors only.** That means no `data-auth` from the pre-paint script. Signed-in people keep Home's install card.
- **Phones and tablets only** (a coarse pointer). The exception is when Chromium has offered its own install dialog.
- **Not asked:**
  - anyone with the app already installed (standalone);
  - automation (`navigator.webdriver`), so the e2e tests and crawlers are never blocked;
  - anyone on `/auth`, `/unsubscribe`, `/card-lab` or `/offline`.

**How often:**
- Once per visit (sessionStorage).
- Closing the sheet in any way counts as "Not now", which holds for 30 days. That key (`INSTALL_DISMISSED`) is shared with Home's card, so one answer quiets both.

**Analytics:** `install_prompt` records `{ action: shown | installed | dismissed, way }`.

**Rejected:**
- **On page load:** a modal before the visitor has seen anything reads as spam, and it would cover the landing page's sign-up.
- **On every visit until installed:** too pushy. Thirty days matches Home's card.
- **A banner instead of a modal:** the owner asked for a modal. The sheet is a modal that is easy to dismiss.
- **On computers:** "home screen" is a phone idea, and desktop Chromium shows its own install icon in the address bar.
- **Showing install steps inside in-app browsers:** they can't install, so the steps would fail. Sending the visitor out to the real browser first is the only way that works.

## Consequences
- `e2e/install.spec.ts` covers four cases: an Android visitor with "Got it" holding after a reload, an iPhone, Instagram's browser, and `/auth` staying quiet. The tests pretend not to be automation.
- The other e2e tests are unaffected, because Playwright sets `navigator.webdriver`.
- Messages: the `Install` namespace (English and Thai).
- No migration and no new package.
