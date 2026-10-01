import type { CardData } from "@/core/cards/types";

/** A profile photo for the footer (ADR 0068); real ones live in the avatars bucket. */
const PHOTO = "/journal/authors/stonie.svg";

/** Hard cases for the card lab and screenshot tests: long titles, every script, missing data. */
export const CARD_FIXTURES: { id: string; data: CardData }[] = [
  {
    // S2 content warnings: a Survived card (the patch, a long scare and a long title).
    id: "survived",
    data: {
      kind: "series", name: "Stranger Things: The Upside Down Special Edition", year: 2016, runtimeMin: 50,
      posterUrl: "https://image.tmdb.org/t/p/w780/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
      rating: 4, finishedOn: "2026-10-31", username: "stonie", avatarUrl: PHOTO, survived: "jumpScares", finishShare: 0.004,
    },
  },
  {
    id: "series-latin",
    data: {
      kind: "series", name: "Stranger Things", year: 2016, episodeCount: 42, seasonCount: 5, runtimeMin: 50,
      posterUrl: "https://image.tmdb.org/t/p/w780/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
      rating: 4.5, review: "Cried at the finale. Worth every one of those episodes, honestly.", finishedOn: "2026-09-26", finishShare: 0.32,
    },
  },
  {
    id: "long-title-thai",
    data: {
      kind: "movie", name: "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb", year: 1964, runtimeMin: 95,
      posterUrl: "https://image.tmdb.org/t/p/w780/gHm96BRW4GoI339rF1vYoYTB6Qe.jpg",
      rating: 3.5, review: "หนังเก่าแต่ยังตลกมาก ฉากสุดท้ายคือที่สุด ใครยังไม่ดูต้องไปดู", finishedOn: "2026-01-05", finishShare: 0.00004,
    },
  },
  {
    id: "korean",
    data: {
      kind: "movie", name: "Parasite", year: 2019, runtimeMin: 133,
      posterUrl: "https://image.tmdb.org/t/p/w780/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
      rating: 5, review: "계단 장면이 아직도 생각나요. 완벽한 영화, 두 번 봐야 해요!", finishedOn: "2026-02-14",
    },
  },
  {
    id: "japanese-no-poster",
    data: {
      kind: "series", name: "千と千尋の神隠し — a very long subtitle to push the layout further", year: null,
      episodeCount: 1024, seasonCount: 21, runtimeMin: 24, posterUrl: null,
      rating: 0.5, review: "もう一度最初から見たい。音楽が本当に美しくて、涙が止まらなかった。最高！", finishedOn: "2026-12-31",
    },
  },
  {
    id: "progress-halfway",
    data: {
      kind: "series", name: "Stranger Things", year: 2016, runtimeMin: 50,
      posterUrl: "https://image.tmdb.org/t/p/w780/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
      finishedOn: "2026-09-27", username: "a_very_long_username_here", avatarUrl: PHOTO,
      progress: { season: 2, episode: 4, watched: 21, total: 42, watchedMin: 1050, milestone: 50 },
    },
  },
  {
    id: "progress-thai-hidden",
    data: {
      kind: "series", name: "เพราะเราคู่กัน", year: 2020, runtimeMin: 45, posterUrl: null,
      finishedOn: "2026-09-27", username: "stonie", hide: ["username", "time"],
      progress: { season: 1, episode: 3, watched: 3, total: 13, watchedMin: 135, milestone: null },
    },
  },
  {
    id: "recap-week",
    data: {
      kind: "series", name: "Stranger Things", posterUrl: "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
      finishedOn: "2026-09-27", username: "stonie",
      recap: {
        from: "2026-09-21", to: "2026-09-27", minutes: 1283, episodes: 17, finished: 2, titleCount: 6,
        titles: [
          { name: "Stranger Things", kind: "series", posterUrl: "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg" },
          { name: "Parasite", kind: "movie", posterUrl: "https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg" },
          { name: "Dr. Strangelove", kind: "movie", posterUrl: "https://image.tmdb.org/t/p/w342/gHm96BRW4GoI339rF1vYoYTB6Qe.jpg" },
          { name: "A title with no poster at all", kind: "series", posterUrl: null },
        ],
      },
    },
  },
  {
    id: "recap-one-japanese",
    data: {
      kind: "movie", name: "千と千尋の神隠し", posterUrl: null, finishedOn: "2027-01-03", hide: ["time"],
      recap: {
        from: "2026-12-28", to: "2027-01-03", minutes: 125, episodes: 0, finished: 1, titleCount: 1,
        titles: [{ name: "千と千尋の神隠し", kind: "movie", posterUrl: null }],
      },
    },
  },
  {
    // Share stats, all time: years in the range and five-digit hours.
    id: "stats-all-time",
    data: {
      kind: "series", name: "Crash Landing on You", posterUrl: null, finishedOn: "2026-09-27", username: "stonie",
      recap: {
        period: "all", from: "2019-03-02", to: "2026-09-27", minutes: 612345, episodes: 8432, finished: 1204, titleCount: 1320,
        titles: [
          { name: "Crash Landing on You", kind: "series", posterUrl: null },
          { name: "Parasite", kind: "movie", posterUrl: "https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg" },
        ],
        favourites: [{ role: "actor", name: "Hyun Bin" }, { role: "director", name: "Bong Joon Ho" }],
      },
    },
  },
  // S2 books & manga: Finish and reading Progress cards (Spine and Manga panel, plus the shared templates).
  {
    id: "book-finish",
    data: {
      kind: "book", name: "Project Hail Mary", year: 2021, pageCount: 497, posterUrl: "/api/covers/-Ff2DwAAQBAJ?size=large",
      rating: 5, review: "Rocky!! Best science buddy ever. Read it in two nights.", finishedOn: "2026-09-20", username: "stonie", avatarUrl: PHOTO, finishShare: 0.042,
    },
  },
  {
    id: "manga-finish-japanese",
    data: {
      kind: "manga", name: "チェンソーマン 第一部 公安編 — a very long subtitle to push the layout further", year: 2018,
      chapterCount: 232, volumeCount: 24, posterUrl: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105778-euxXZEIfDY2u.png",
      rating: 4.5, review: "最後のページで叫んだ。最高のマンガ、もう一度最初から読みたい！", finishedOn: "2026-09-27", finishShare: 0.0009,
    },
  },
  {
    id: "reading-manga-running",
    data: {
      kind: "manga", name: "One Piece", year: 1997, posterUrl: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg",
      finishedOn: "2026-09-27", username: "a_very_long_username_here",
      reading: { unit: "chapter", position: 1100, total: null, readMin: 5500, milestone: null },
    },
  },
  {
    id: "reading-book-thai-halfway",
    data: {
      kind: "book", name: "สี่แผ่นดิน", year: 1953, pageCount: 1076, posterUrl: null, finishedOn: "2026-09-27", hide: ["username"],
      reading: { unit: "page", position: 538, total: 1076, readMin: 807, milestone: 50 },
    },
  },
  // S3 games: Finish cards (the Cartridge, plus the shared templates) with the player's hours, or RAWG's average.
  {
    id: "game-finish",
    data: {
      kind: "game", name: "The Witcher 3: Wild Hunt – Complete Edition", year: 2015, playtimeHours: 43, hoursPlayed: 187,
      posterUrl: "https://media.rawg.io/media/resize/640/-/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg",
      rating: 5, review: "Gwent took 40 of those hours and I regret nothing.", finishedOn: "2026-09-30", username: "stonie", avatarUrl: PHOTO, finishShare: 0.18,
    },
  },
  {
    id: "game-average-japanese",
    data: {
      kind: "game", name: "ゼルダの伝説 ティアーズ オブ ザ キングダム", year: 2023, playtimeHours: 61, posterUrl: null,
      rating: 4.5, review: "空の島が最高。もう一度最初から遊びたい！", finishedOn: "2026-09-29", hide: ["username"],
    },
  },
  // S2 milestones & recaps: Milestone cards, a Monthly Recap with reading, Year in Review.
  {
    id: "milestone-100th",
    data: {
      kind: "movie", name: "Parasite", posterUrl: "https://image.tmdb.org/t/p/w780/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
      finishedOn: "2026-09-27", username: "stonie", milestone: { metric: "titles", value: 100 },
    },
  },
  {
    id: "milestone-hours-thai",
    data: {
      kind: "series", name: "เพราะเราคู่กัน ภาคพิเศษ ตอนจบที่ยาวมากเพื่อทดสอบการตัดบรรทัด", posterUrl: null,
      finishedOn: "2026-12-31", milestone: { metric: "hours", value: 10000 },
    },
  },
  // S3 challenges & clubs: Challenge cards (October: five rows; August 2026: six rows, every day circled, a long Thai title).
  {
    id: "challenge-fright",
    data: {
      kind: "series", name: "Stranger Things", posterUrl: "https://image.tmdb.org/t/p/w780/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
      finishedOn: "2026-10-24", username: "stonie",
      challenge: { slug: "fright-month", month: "2026-10", target: 3, days: [2, 3, 9, 14, 15, 21, 24] },
    },
  },
  {
    id: "challenge-days-thai",
    data: {
      kind: "series", name: "เพราะเราคู่กัน ภาคพิเศษ ตอนจบที่ยาวมากเพื่อทดสอบการตัดบรรทัด", posterUrl: null,
      finishedOn: "2026-08-31", hide: ["username"],
      challenge: { slug: "twelve-days", month: "2026-08", target: 12, days: Array.from({ length: 31 }, (_, i) => i + 1) },
    },
  },
  {
    id: "recap-month-reading",
    data: {
      kind: "manga", name: "One Piece", posterUrl: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg",
      finishedOn: "2026-09-30", username: "stonie",
      recap: {
        period: "month", from: "2026-09-01", to: "2026-09-30", minutes: 2410, episodes: 38, finished: 4, titleCount: 7, readMinutes: 1244,
        titles: [
          { name: "One Piece", kind: "manga", posterUrl: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg" },
          { name: "Stranger Things", kind: "series", posterUrl: "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg" },
          { name: "Project Hail Mary", kind: "book", posterUrl: "/api/covers/-Ff2DwAAQBAJ" },
          { name: "Parasite", kind: "movie", posterUrl: "https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg" },
        ],
      },
    },
  },
  {
    id: "year-review",
    data: {
      kind: "series", name: "Stranger Things", posterUrl: "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
      finishedOn: "2026-12-31", username: "a_very_long_username_here", avatarUrl: PHOTO,
      recap: {
        period: "year", from: "2026-01-01", to: "2026-12-31", minutes: 61234, episodes: 1432, finished: 187, titleCount: 240, readMinutes: 9120,
        titles: [
          { name: "Stranger Things", kind: "series", posterUrl: "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg" },
          { name: "Parasite", kind: "movie", posterUrl: "https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg" },
          { name: "One Piece", kind: "manga", posterUrl: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg" },
          { name: "A title with no poster at all", kind: "movie", posterUrl: null },
        ],
        highlights: { genre: "Science Fiction & Fantasy", month: "2026-07", streak: 41 },
        favourites: [{ role: "actor", name: "Maximiliano Hernández-Villanueva" }, { role: "director", name: "ポン・ジュノ" }],
      },
    },
  },
  {
    // A running year with one title and no standouts: sparse, and Thai in the collage.
    id: "year-review-sparse",
    data: {
      kind: "movie", name: "เพราะเราคู่กัน", posterUrl: null, finishedOn: "2026-02-03", hide: ["time"],
      recap: {
        period: "year", from: "2026-01-01", to: "2026-02-03", minutes: 95, episodes: 0, finished: 1, titleCount: 1,
        titles: [{ name: "เพราะเราคู่กัน", kind: "movie", posterUrl: null }], highlights: {},
      },
    },
  },
  // Stage 4 daily game: Reel of the Day, spoiler-free (no poster, no name).
  {
    id: "reel-solved",
    data: {
      kind: "movie", name: "Reel of the Day #6", posterUrl: null, finishedOn: "2026-10-05", username: "a_very_long_username_here",
      reel: { number: 6, day: "2026-10-05", results: [false, false, true], solved: true, streak: 128 },
    },
  },
  {
    id: "reel-lost",
    data: {
      kind: "movie", name: "Reel of the Day #1235", posterUrl: null, finishedOn: "2030-02-15",
      reel: { number: 1235, day: "2030-02-15", results: [false, false, false, false, false, false], solved: false, streak: 0 },
    },
  },
  // Stage 4 Atlas: a few neighbours (the map zooms in) and many far apart (the world, tiny ones as dots).
  {
    id: "atlas-few",
    data: { kind: "movie", name: "Atlas", posterUrl: null, finishedOn: "2026-10-01", username: "maya", avatarUrl: PHOTO, atlas: { countries: ["ES", "FR", "IT", "PT"], stories: 0 } },
  },
  {
    id: "atlas-many",
    data: {
      kind: "movie", name: "Atlas", posterUrl: null, finishedOn: "2026-10-01", username: "a_very_long_username_here",
      atlas: { countries: ["AU", "BR", "CA", "DE", "ES", "FR", "GB", "IT", "JP", "KR", "MT", "MV", "MX", "NZ", "PE", "SG", "TH", "US", "VN", "ZA"], stories: 34 },
    },
  },
  // A country's card (ADR 0060): a wide one with insets (Alaska, Hawaii) and a tall one (Japan, with Okinawa).
  {
    id: "atlas-us",
    data: {
      kind: "movie", name: "United States", posterUrl: null, finishedOn: "2026-10-01", username: "maya",
      atlas: { countries: ["US"], stories: 0, regions: { country: "US", kind: "state", total: 51, ids: ["US-AK", "US-CA", "US-HI", "US-NV", "US-NY", "US-OR", "US-WA"] } },
    },
  },
  {
    id: "atlas-japan",
    data: {
      kind: "movie", name: "Japan", posterUrl: null, finishedOn: "2026-10-01", username: "a_very_long_username_here",
      atlas: {
        countries: ["JP"],
        stories: 0,
        regions: { country: "JP", kind: "prefecture", total: 47, ids: ["JP-01", "JP-13", "JP-14", "JP-22", "JP-23", "JP-26", "JP-27", "JP-28", "JP-34", "JP-40", "JP-47"] },
      },
    },
  },
  {
    id: "bare",
    data: { kind: "movie", name: "M", finishedOn: "2026-09-26" },
  },
];
