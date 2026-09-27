import { describe, expect, it } from "vitest";
import { escapeHtml, launchCtaUrl, launchEmail, type LaunchCopy } from "./launch";
import { isSignInAction, signInEmail, signInLink, type SignInCopy } from "./sign-in";
import { recapCtaUrl, recapEmail, type RecapCopy } from "./recap";
import { isEmailList, isUuid, unsubscribeLinks, unsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe";
import { signWebhook, verifyWebhook } from "./webhook";

const ID = "0192f4c5-7a1b-7c3d-8e4f-5a6b7c8d9e0f";
const OTHER = "0192f4c5-7a1b-7c3d-8e4f-5a6b7c8d9e10";
const SECRET = "test-secret";

describe("unsubscribe tokens", () => {
  it("verifies its own token and rejects everything else", async () => {
    const token = await unsubscribeToken(SECRET, ID);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await verifyUnsubscribeToken(SECRET, ID, token)).toBe(true);
    expect(await verifyUnsubscribeToken(SECRET, ID.toUpperCase(), token)).toBe(true);
    expect(await verifyUnsubscribeToken(SECRET, OTHER, token)).toBe(false);
    expect(await verifyUnsubscribeToken("another-secret", ID, token)).toBe(false);
    expect(await verifyUnsubscribeToken(SECRET, ID, token.slice(1))).toBe(false);
    expect(await verifyUnsubscribeToken(SECRET, ID, "")).toBe(false);
    expect(await verifyUnsubscribeToken(SECRET, "not-a-uuid", token)).toBe(false);
  });

  it("is stable for the same id", async () => {
    expect(await unsubscribeToken(SECRET, ID)).toBe(await unsubscribeToken(SECRET, ID));
    expect(await unsubscribeToken(SECRET, ID)).not.toBe(await unsubscribeToken(SECRET, OTHER));
  });

  it("checks uuid shape", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid("1; drop table")).toBe(false);
  });

  it("builds the confirm page per locale and the one-click API link", () => {
    const site = new URL("https://mystonie.app");
    expect(unsubscribeLinks(site, "en", "en", ID, "tok")).toEqual({
      page: `https://mystonie.app/unsubscribe?id=${ID}&t=tok`,
      oneClick: `https://mystonie.app/api/unsubscribe?id=${ID}&t=tok`,
    });
    expect(unsubscribeLinks(site, "th", "en", ID, "tok").page).toBe(`https://mystonie.app/th/unsubscribe?id=${ID}&t=tok`);
    expect(unsubscribeLinks(site, "en", "en", ID, "tok", "recaps").oneClick).toBe(`https://mystonie.app/api/unsubscribe?id=${ID}&t=tok&list=recaps`);
  });

  it("signs each list separately, and the waitlist as before", async () => {
    const recaps = await unsubscribeToken(SECRET, ID, "recaps");
    expect(recaps).not.toBe(await unsubscribeToken(SECRET, ID));
    expect(await unsubscribeToken(SECRET, ID, "waitlist")).toBe(await unsubscribeToken(SECRET, ID));
    expect(await verifyUnsubscribeToken(SECRET, ID, recaps, "recaps")).toBe(true);
    expect(await verifyUnsubscribeToken(SECRET, ID, recaps)).toBe(false);
    expect(isEmailList("recaps")).toBe(true);
    expect(isEmailList("marketing")).toBe(false);
  });
});

describe("recap email", () => {
  const copy: RecapCopy = {
    subject: "Your week: Sep 21 – 27",
    preheader: "Pre",
    stamp: "YOUR WEEK",
    heading: "Here's <your> week",
    body: "2 titles & counting.",
    cta: "Open my recap card",
    why: "Weekly recaps are on.",
    unsubscribe: "Turn off weekly recaps",
  };
  const links = {
    cta: recapCtaUrl(new URL("https://mystonie.app"), "th", "en", ID),
    unsubscribe: `https://mystonie.app/th/unsubscribe?id=${ID}&t=tok&list=recaps`,
    logo: "https://mystonie.app/apple-icon",
    sender: "Mystonie · codenat.me",
  };

  it("links the recap page with campaign tags, per locale", () => {
    expect(links.cta).toBe(`https://mystonie.app/th/recap/${ID}?utm_source=recap&utm_medium=email&utm_campaign=weekly_recap`);
    expect(recapCtaUrl(new URL("https://mystonie.app"), "en", "en", ID)).toMatch(new RegExp(`^https://mystonie.app/recap/${ID}\\?`));
  });

  it("shows the numbers and posters, escapes copy, and links the unsubscribe page", () => {
    const posters = [{ url: "https://image.tmdb.org/t/p/w185/a.jpg", alt: "Tom & Jerry" }];
    const figures = [
      { value: "9", label: "hours" },
      { value: "12", label: "episodes" },
    ];
    const { subject, html, text } = recapEmail(copy, { figures, posters, links }, "th");
    expect(subject).toBe(copy.subject);
    expect(html).toContain('<html lang="th">');
    expect(html).toContain("Here&#39;s &lt;your&gt; week");
    expect(html).toContain(">12</p>");
    expect(html).toContain('alt="Tom &amp; Jerry"');
    expect(html).toContain(`href="${escapeHtml(links.cta)}"`);
    expect(html).toContain(`href="${escapeHtml(links.unsubscribe)}"`);
    expect(text).toContain("9 hours · 12 episodes");
    expect(text).toContain(`Open my recap card: ${links.cta}`);
    expect(text).toContain(`Turn off weekly recaps: ${links.unsubscribe}`);
  });
});

describe("launch email", () => {
  const copy: LaunchCopy = {
    subject: "Mystonie is here",
    preheader: "Pre",
    stamp: "OPEN",
    heading: "Your <collection> is open",
    body: "Tom & Jerry's body",
    cta: "Start",
    why: "You joined the waitlist.",
    unsubscribe: "Unsubscribe",
  };
  const links = {
    cta: "https://mystonie.app/?utm_source=waitlist&utm_medium=email&utm_campaign=launch",
    unsubscribe: `https://mystonie.app/unsubscribe?id=${ID}&t=tok`,
    logo: "https://mystonie.app/apple-icon",
    sender: "Mystonie · codenat.me",
  };

  it("escapes copy, links the CTA and the unsubscribe page, and sets lang", () => {
    const { subject, html, text } = launchEmail(copy, links, "th");
    expect(subject).toBe("Mystonie is here");
    expect(html).toContain('<html lang="th">');
    expect(html).toContain("Your &lt;collection&gt; is open");
    expect(html).toContain("Tom &amp; Jerry&#39;s body");
    expect(html).toContain(`href="${escapeHtml(links.cta)}"`);
    expect(html).toContain(`href="${escapeHtml(links.unsubscribe)}"`);
    expect(html).not.toContain("<collection>");
    expect(text).toContain(`Start: ${links.cta}`);
    expect(text).toContain(`Unsubscribe: ${links.unsubscribe}`);
    expect(text).toContain("Your <collection> is open");
  });

  it("tracks out Latin stamps only", () => {
    expect(launchEmail(copy, links, "en").html).toContain("letter-spacing:3px");
    expect(launchEmail({ ...copy, stamp: "เปิดแล้ว" }, links, "th").html).not.toContain("letter-spacing:3px");
  });

  it("tags the CTA for landing attribution", () => {
    expect(launchCtaUrl(new URL("https://mystonie.app/th"))).toBe(links.cta);
  });
});

describe("auth hook signatures", () => {
  // Same shape as the secrets Supabase generates: v1,whsec_<base64>.
  const secret = `v1,whsec_${btoa("0123456789abcdef0123456789abcdef")}`;
  const now = 1_790_000_000;
  const body = '{"user":{"email":"a@b.co"}}';

  it("accepts its own signature and rejects tampering, other secrets and stale timestamps", async () => {
    const signature = await signWebhook(secret, "msg_1", String(now), body);
    expect(signature).toMatch(/^v1,[A-Za-z0-9+/]+=*$/);
    const headers = { id: "msg_1", timestamp: String(now), signature };
    expect(await verifyWebhook(secret, headers, body, now)).toBe(true);
    expect(await verifyWebhook(secret, { ...headers, signature: `v1,bad ${signature}` }, body, now)).toBe(true);
    expect(await verifyWebhook(secret, headers, `${body} `, now)).toBe(false);
    expect(await verifyWebhook(secret, { ...headers, id: "msg_2" }, body, now)).toBe(false);
    expect(await verifyWebhook(`v1,whsec_${btoa("another-secret-another-secret!!")}`, headers, body, now)).toBe(false);
    expect(await verifyWebhook(secret, headers, body, now + 301)).toBe(false);
    expect(await verifyWebhook(secret, { ...headers, signature: null }, body, now)).toBe(false);
    expect(await verifyWebhook("", headers, body, now)).toBe(false);
    expect(await verifyWebhook("v1,whsec_%%%", headers, body, now)).toBe(false);
  });
});

describe("sign-in email", () => {
  const copy: SignInCopy = {
    subject: "123456 is your Mystonie code",
    preheader: "Pre",
    stamp: "SIGN IN",
    heading: "Your sign-in code",
    body: "Type this code <here>.",
    cta: "Sign in",
    expiry: "Works for an hour.",
    ignore: "Didn't ask? Ignore this.",
  };
  const fallback = new URL("https://mystonie.app/auth/confirm");

  it("links to our confirm page with the token hash", () => {
    expect(signInLink("https://mystonie.app/th/auth/confirm?next=%2Fth%2Fsettings", fallback, "hash1", "magiclink")).toBe(
      "https://mystonie.app/th/auth/confirm?next=%2Fth%2Fsettings&token_hash=hash1&type=magiclink",
    );
    // Supabase falls back to the Site URL when a redirect isn't allow-listed: use our page instead.
    expect(signInLink("https://mystonie.app", fallback, "h", "signup")).toBe("https://mystonie.app/auth/confirm?token_hash=h&type=signup");
    expect(signInLink("not a url", fallback, "h", "email")).toBe("https://mystonie.app/auth/confirm?token_hash=h&type=email");
    expect(fallback.search).toBe("");
  });

  it("knows which actions are sign-ins", () => {
    expect(isSignInAction("magiclink")).toBe(true);
    expect(isSignInAction("recovery")).toBe(false);
  });

  it("puts the code in the subject and body, escapes copy and links the button", () => {
    const link = "https://mystonie.app/auth/confirm?token_hash=h&type=signup";
    const { subject, html, text } = signInEmail(copy, { code: "123456", link, logo: "https://mystonie.app/apple-icon", sender: "Mystonie" }, "th");
    expect(subject).toBe("123456 is your Mystonie code");
    expect(html).toContain('<html lang="th">');
    expect(html).toContain(">123456</p>");
    expect(html).toContain("Type this code &lt;here&gt;.");
    expect(html).toContain(`href="${escapeHtml(link)}"`);
    expect(text).toContain("123456");
    expect(text).toContain(`Sign in: ${link}`);
  });
});
