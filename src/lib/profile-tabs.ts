// Someone's tabs at /u/<username> (ADR 0077, ADR 0092), shared by the server pages and the client tabs.

export type ProfileTab = "album" | "stats" | "journal";

/** Someone's tabs in order: Album always, Stats unless all of it is hidden (ADR 0077), Journal once they published (ADR 0092). */
export const profileTabs = ({ stats, journal }: { stats: boolean; journal: boolean }): ProfileTab[] => [
  "album",
  ...(stats ? (["stats"] as const) : []),
  ...(journal ? (["journal"] as const) : []),
];

/** A profile tab's address. */
export const profileTabHref = (username: string, tab: ProfileTab) => (tab === "album" ? `/u/${username}` : `/u/${username}/${tab}`);
