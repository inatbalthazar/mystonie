/**
 * Operator / data controller details shown on the Privacy and Terms pages. The public addresses forward to the
 * owner's inbox (Spaceship email forwarding, ADR 0087).
 */
export const LEGAL = {
  contactEmail: "privacy@mystonie.com",
  /** Everything that isn't about privacy or the terms: the Report a problem page, the push service's contact. */
  helloEmail: "hello@mystonie.com",
  /**
   * Where the app's own mail to the team goes (beta reports, reported profiles and cards): straight to the inbox, not
   * through the forwarding, which can land a mail sent from our own domain in spam.
   */
  teamInbox: "inatbalthazar@gmail.com",
  operatorSite: "https://www.codenat.me/",
  /** Bump when the policy text changes (shown as "Last updated"). */
  updatedOn: "2026-10-06",
} as const;
