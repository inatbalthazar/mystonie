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
    id: "bare",
    data: { kind: "movie", name: "M", finishedOn: "2026-09-26" },
  },
];
