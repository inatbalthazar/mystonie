import type { CardData } from "@/core/cards/types";

/** Hard cases for the card lab and screenshot tests: long titles, every script, missing data. */
export const CARD_FIXTURES: { id: string; data: CardData }[] = [
  {
    id: "series-latin",
    data: {
      kind: "series", name: "Stranger Things", year: 2016, episodeCount: 42, seasonCount: 5, runtimeMin: 50,
      posterUrl: "https://image.tmdb.org/t/p/w780/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
      rating: 4.5, review: "Cried at the finale. Worth every one of those episodes, honestly.", finishedOn: "2026-09-26",
    },
  },
  {
    id: "long-title-thai",
    data: {
      kind: "movie", name: "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb", year: 1964, runtimeMin: 95,
      posterUrl: "https://image.tmdb.org/t/p/w780/gHm96BRW4GoI339rF1vYoYTB6Qe.jpg",
      rating: 3.5, review: "หนังเก่าแต่ยังตลกมาก ฉากสุดท้ายคือที่สุด ใครยังไม่ดูต้องไปดู", finishedOn: "2026-01-05",
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
      finishedOn: "2026-09-27", username: "a_very_long_username_here",
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
      },
    },
  },
  {
    id: "bare",
    data: { kind: "movie", name: "M", finishedOn: "2026-09-26" },
  },
];
