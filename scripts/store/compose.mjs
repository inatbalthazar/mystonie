// Lays the captures out as the Play Store's phone screenshots (1080 × 1920) and feature graphic (1024 × 500), in the
// scrapbook of the app: paper, tape, a pen and real stickers. Playwright saves them as PNGs without alpha.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { LOCALES, OUT, RAW, ROOT } from "./lib.mjs";

const url = (path) => pathToFileURL(path).href;
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Caveat:wght@400..700&family=Geist:wght@400..800&family=Mali:wght@500;600;700&family=Noto+Sans+Thai:wght@400..800&display=block" rel="stylesheet">`;
const GRAIN = (rgb, alpha) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

// The phone: a 412 × 892 capture under a status bar, drawn 600 px wide.
const SCREEN_W = 600;
const SCALE = SCREEN_W / 412;
const STATUS_H = 50;
const APP_H = Math.round(892 * SCALE);
const BEZEL = 14;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = STATUS_H + APP_H + BEZEL * 2;

// Layout per slide; `note.from`/`to` draw the pen's arrow onto the screen, in slide pixels.
const SLIDES = [
  { id: "01-card", theme: "paper", shot: "celebrate", tilt: -1.5, shift: 60, stickers: [["sticker-0", 842, 500, 196, 14]],
    note: { x: 52, y: 930, rot: -7, from: [120, 1062], to: [424, 1118], bend: 0.3 } },
  { id: "02-shelf", theme: "soft", shot: "album-shelf", tilt: 1.5, top: 482, kinds: true },
  { id: "03-stats", theme: "night", shot: "stats-numbers", tilt: -1.5, shift: 60,
    note: { x: 32, y: 640, rot: -6, from: [112, 772], to: [318, 846], bend: 0.35 } },
  { id: "04-friends", theme: "paper", shot: "feed-items", tilt: 1.5, shift: -60,
    note: { x: 808, y: 740, rot: 6, from: [884, 872], to: [716, 950], bend: -0.3 } },
  { id: "05-episodes", theme: "soft", shot: "shogun-progress", tilt: -1.5, shift: -60,
    note: { x: 810, y: 890, rot: 5, from: [900, 1012], to: [724, 1074], bend: -0.35 } },
  { id: "06-atlas", theme: "night", shot: "atlas-been", tilt: 1.5, shift: 60,
    note: { x: 26, y: 1250, rot: -5, from: [96, 1238], to: [332, 1196], bend: -0.35 } },
  { id: "07-stickers", theme: "soft", shot: "stats-milestones", tilt: -1.5,
    stickers: [["sticker-4", 24, 610, 190, -12], ["sticker-5", 878, 1000, 176, 11], ["sticker-2", 40, 1500, 160, 8]] },
  { id: "08-warnings", theme: "paper", shot: "legend", tilt: 1.5, shift: 60,
    note: { x: 36, y: 1150, rot: -6, from: [118, 1140], to: [334, 1046], bend: -0.3 } },
];

// The headlines are the landing page's tour (ADR 0089); the notes are what the pen would write next to the photo.
const COPY = {
  en: {
    kinds: ["Movies", "Series", "Books", "Manga", "Games"],
    "01-card": ["Turn every finish<br>into <mark>art</mark>.", "ready to<br>share!"],
    "02-shelf": ["Your whole collection,<br><mark>on one shelf</mark>."],
    "03-stats": ["Your year in<br><mark>big numbers</mark>.", "245 hours<br>so far!"],
    "04-friends": ["Better with<br><mark>friends</mark>.", "stamp their<br>finishes"],
    "05-episodes": ["Every episode,<br>chapter and <mark>level</mark>.", "one tap<br>per episode"],
    "06-atlas": ["See the world<br><mark>from your couch</mark>.", "been there,<br>watched that"],
    "07-stickers": ["Stickers for every<br><mark>milestone</mark>."],
    "08-warnings": ["Know before you<br><mark>press play</mark>.", "no nasty<br>surprises"],
    feature: ["Finished it?<br><mark>Mystonie it.</mark>", "Log the shows, movies, books, manga and games you finish. Get a card worth sharing.", "Finished"],
  },
  th: {
    kinds: ["หนัง", "ซีรีส์", "หนังสือ", "มังงะ", "เกม"],
    "01-card": ["เปลี่ยนทุกเรื่องที่จบ<br>เป็น<mark>งานอาร์ต</mark>", "พร้อม<br>แชร์แล้ว!"],
    "02-shelf": ["ทุกเรื่องที่คุณจบ<br><mark>เรียงบนชั้นเดียว</mark>"],
    "03-stats": ["ทั้งปีของคุณ<br>ใน<mark>ตัวเลขใหญ่ๆ</mark>", "245 ชั่วโมง<br>แล้วนะ!"],
    "04-friends": ["สนุกกว่า<br>เมื่อมี<mark>เพื่อน</mark>", "ประทับตรา<br>ให้เพื่อน"],
    "05-episodes": ["ทุกตอน ทุกบท<br>ทุก<mark>ด่าน</mark>", "ตอนละ<br>แตะเดียว"],
    "06-atlas": ["เที่ยวรอบโลก<br><mark>จากโซฟา</mark>", "ไปมาแล้ว<br>ดูมาแล้ว"],
    "07-stickers": ["สติกเกอร์สำหรับ<br>ทุก<mark>หมุดหมาย</mark>"],
    "08-warnings": ["รู้ก่อน<br><mark>กดเล่น</mark>", "ไม่ต้องลุ้น<br>ไม่ต้องตกใจ"],
    feature: ["ดูจบแล้ว?<br><mark>Mystonie เลย</mark>", "บันทึกซีรีส์ หนัง หนังสือ มังงะ และเกมที่คุณจบ แล้วได้การ์ดสวยๆ ไว้แชร์", "ดูจบแล้ว"],
  },
};

/** The pen's arrow: a quadratic curve bent sideways by `bend`, with an open head. */
function arrow([x1, y1], [x2, y2], bend) {
  const cx = (x1 + x2) / 2 - (y2 - y1) * bend;
  const cy = (y1 + y2) / 2 + (x2 - x1) * bend;
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const head = (a) => `${(x2 - 30 * Math.cos(angle + a)).toFixed(1)},${(y2 - 30 * Math.sin(angle + a)).toFixed(1)}`;
  return `<path d="M${x1},${y1} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2},${y2}"/><path d="M${head(-0.5)} L${x2},${y2} L${head(0.5)}"/>`;
}

const STATUS_ICONS = `
  <svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 20 L20 2 L20 20 Z" fill="currentColor"/></svg>
  <svg width="24" height="22" viewBox="0 0 24 22"><path d="M12 20 L1.5 7.2 A15.5 15.5 0 0 1 22.5 7.2 Z" fill="currentColor"/></svg>
  <svg width="30" height="22" viewBox="0 0 30 22"><rect x="1" y="4" width="24" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="7" width="15" height="8" rx="2" fill="currentColor"/><rect x="26.5" y="8.5" width="2.5" height="5" rx="1.2" fill="currentColor"/></svg>`;

function slide(s, locale) {
  const th = locale === "th";
  const [title, noteText] = COPY[locale][s.id];
  const dark = s.theme === "night";
  const left = (1080 - PHONE_W) / 2 + (s.shift ?? 0);
  const kinds = s.kinds
    ? `<div class="kinds">${COPY[locale].kinds.map((k, i) => `<span style="transform:rotate(${[-2, 1.5, -1, 2, -1.5][i]}deg)">${k}</span>`).join("")}</div>`
    : "";
  const stickers = (s.stickers ?? [])
    .map(([name, x, y, size, rot]) => `<img class="sticker" src="${url(join(RAW, `${name}.png`))}" style="left:${x}px;top:${y}px;width:${size}px;transform:rotate(${rot}deg)">`)
    .join("");
  const note = s.note
    ? `<div class="note" style="left:${s.note.x}px;top:${s.note.y}px;transform:rotate(${s.note.rot}deg)">${noteText}</div>
       <svg class="ink" width="1080" height="1920">${arrow(s.note.from, s.note.to, s.note.bend)}</svg>`
    : "";
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">${FONTS}
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:1080px; height:1920px; overflow:hidden; }
  body { position:relative; background:var(--bg); color:var(--fg); font-family:Geist, "Noto Sans Thai", sans-serif; }
  .paper { --bg:#fbf9f5; --fg:#1d1713; --mark:#cf3c12; --pen:#cf3c12; --frame:#1d1713; --tape:rgba(255,206,180,.9); }
  .soft { --bg:#ffe8dc; --fg:#1d1713; --mark:#cf3c12; --pen:#b8330e; --frame:#1d1713; --tape:rgba(255,250,244,.82); }
  .night { --bg:#161310; --fg:#f5f1ec; --mark:#f47249; --pen:#f47249; --frame:#3b332c; --tape:rgba(244,114,73,.5); }
  .grain { position:absolute; inset:0; pointer-events:none; opacity:.55; mix-blend-mode:multiply; background-image:${GRAIN([0.35, 0.27, 0.2], 0.09)}; }
  .night .grain { opacity:.35; mix-blend-mode:screen; background-image:${GRAIN([0.9, 0.8, 0.7], 0.07)}; }
  h1 { position:absolute; left:56px; right:56px; top:${th ? 104 : 118}px; text-align:center;
    font-family:"Bricolage Grotesque", "Noto Sans Thai", sans-serif; font-weight:800; font-size:${th ? 90 : 102}px;
    line-height:${th ? 1.22 : 1}; letter-spacing:${th ? "-0.005em" : "-0.022em"}; font-variation-settings:"opsz" 96, "wdth" 100; }
  h1 mark { background:none; color:var(--mark); }
  .kinds { position:absolute; left:0; right:0; top:${th ? 352 : 346}px; display:flex; justify-content:center; gap:14px; }
  .kinds span { background:#1d1713; color:#f5f1ec; font:700 ${th ? 30 : 26}px/1 ${th ? '"Noto Sans Thai"' : "Geist"}, sans-serif;
    letter-spacing:${th ? "0.02em" : "0.14em"}; text-transform:uppercase; padding:${th ? "12px 20px 14px" : "14px 20px"}; border-radius:6px;
    box-shadow:0 1px 1px rgba(0,0,0,.25), 0 6px 12px -6px rgba(29,23,19,.5), inset 0 1px 0 rgba(255,255,255,.12);
    text-shadow:0 1px 0 rgba(0,0,0,.5), 0 -1px 0 rgba(255,255,255,.18); }
  .phone { position:absolute; left:${left}px; top:${s.top ?? 470}px; width:${PHONE_W}px; height:${PHONE_H}px; padding:${BEZEL}px;
    border-radius:70px; background:var(--frame); transform:rotate(${s.tilt}deg);
    box-shadow:0 2px 6px rgba(29,23,19,.14), 0 48px 90px -36px rgba(29,23,19,.6); }
  .night .phone { box-shadow:0 2px 6px rgba(0,0,0,.4), 0 48px 90px -30px rgba(0,0,0,.85), inset 0 0 0 2px rgba(245,241,236,.08); }
  .screen { position:relative; width:${SCREEN_W}px; height:${STATUS_H + APP_H}px; border-radius:56px; overflow:hidden; background:${dark ? "#120f0c" : "#fcfaf6"}; }
  .status { height:${STATUS_H}px; display:flex; align-items:center; justify-content:space-between; padding:6px 40px 0 44px; color:${dark ? "#f5f1ec" : "#1d1713"}; }
  .time { font:600 24px/1 Geist, sans-serif; letter-spacing:.01em; }
  .icons { display:flex; align-items:center; gap:8px; }
  .cam { position:absolute; left:50%; top:16px; width:22px; height:22px; margin-left:-11px; border-radius:50%; background:#0b0907; box-shadow:inset 0 0 0 3px #1c1714; }
  .app { display:block; width:${SCREEN_W}px; height:${APP_H}px; }
  .tape { position:absolute; z-index:2; top:-14px; width:176px; height:54px; background:var(--tape); box-shadow:0 1px 2px rgba(29,23,19,.12);
    clip-path:polygon(0 0,100% 0,97% 14%,100% 28%,97% 42%,100% 57%,97% 71%,100% 85%,97% 100%,0 100%,3% 86%,0 72%,3% 58%,0 43%,3% 29%,0 15%); }
  .tape.l { left:-44px; transform:rotate(-38deg); }
  .tape.r { right:-44px; transform:rotate(38deg); }
  .sticker { position:absolute; z-index:3; filter:drop-shadow(0 10px 14px rgba(29,23,19,.28)); }
  .note { position:absolute; z-index:4; color:var(--pen); white-space:nowrap; font:${th ? "600 42px/1.32 Mali" : "600 56px/0.98 Caveat"}, cursive; }
  .ink { position:absolute; left:0; top:0; z-index:4; overflow:visible; fill:none; stroke:var(--pen); stroke-width:5; stroke-linecap:round; stroke-linejoin:round; }
</style></head>
<body class="${s.theme}">
  <div class="grain"></div>
  <h1>${title}</h1>
  ${kinds}
  <div class="phone">
    <span class="tape l"></span><span class="tape r"></span>
    <div class="screen">
      <div class="status"><span class="time">9:41</span><span class="icons">${STATUS_ICONS}</span></div>
      <span class="cam"></span>
      <img class="app" src="${url(join(RAW, locale, `${s.shot}.png`))}">
    </div>
  </div>
  ${stickers}
  ${note}
</body></html>`;
}

// The feature graphic: the brand line, and one real card per kind fanned out with the FINISHED stamp on top.
const FAN = [
  ["cartridge-hades", -162, 24, -11, 1],
  ["spine-pachinko", -81, 7, -5.5, 2],
  ["polaroid-past-lives", 0, 0, 0, 5],
  ["panel-spy", 81, 7, 5.5, 2],
  ["boldstats-severance", 162, 24, 11, 1],
];

function feature(locale) {
  const th = locale === "th";
  const [title, line, stamp] = COPY[locale].feature;
  const cards = FAN.map(([name, dx, dy, rot, z]) =>
    `<img class="card" src="${url(join(RAW, locale, `card-${name}.png`))}" style="transform:translate(${dx}px,${dy}px) rotate(${rot}deg);z-index:${z}">`).join("");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">${FONTS}
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:1024px; height:500px; overflow:hidden; }
  body { position:relative; background:#fbf9f5; color:#1d1713; font-family:Geist, "Noto Sans Thai", sans-serif; }
  .grain { position:absolute; inset:0; opacity:.6; mix-blend-mode:multiply; background-image:${GRAIN([0.35, 0.27, 0.2], 0.09)}; }
  .copy { position:absolute; left:64px; top:0; bottom:0; width:${th ? 420 : 410}px; display:flex; flex-direction:column; justify-content:center; gap:${th ? 18 : 22}px; }
  .copy img { width:210px; height:auto; }
  h1 { font-family:"Bricolage Grotesque", "Noto Sans Thai", sans-serif; font-weight:800; font-size:${th ? 62 : 70}px;
    line-height:${th ? 1.2 : 0.98}; letter-spacing:${th ? "0" : "-0.025em"}; font-variation-settings:"opsz" 96, "wdth" 100; }
  h1 mark { background:none; color:#cf3c12; }
  p { font-size:${th ? 20 : 21}px; line-height:1.45; font-weight:500; color:#5d5248; max-width:${th ? 380 : 360}px; }
  .fan { position:absolute; left:724px; top:244px; }
  .card { position:absolute; left:-76px; top:-135px; width:152px; height:270px; border-radius:8px;
    box-shadow:0 1px 2px rgba(29,23,19,.18), 0 18px 30px -12px rgba(29,23,19,.5); }
  .stamp { position:absolute; left:${th ? 742 : 724}px; top:334px; z-index:9; transform:rotate(-8deg);
    border:5px solid #cf3c12; border-radius:12px; padding:5px; background:rgba(251,249,245,.88); }
  .stamp span { display:block; border:2px solid #cf3c12; border-radius:6px; padding:${th ? "4px 16px 6px" : "6px 16px"}; color:#cf3c12;
    font:800 ${th ? 30 : 32}px/1 ${th ? '"Noto Sans Thai"' : '"Bricolage Grotesque"'}, sans-serif; letter-spacing:${th ? "0" : "0.12em"}; text-transform:uppercase; }
</style></head>
<body>
  <div class="grain"></div>
  <div class="copy"><img src="${url(join(ROOT, "brand", "svg", "mystonie-logo.svg"))}" alt="Mystonie"><h1>${title}</h1><p>${line}</p></div>
  <div class="fan">${cards}</div>
  <div class="stamp"><span>${stamp}</span></div>
</body></html>`;
}

async function render(page, html, path) {
  const source = join(RAW, "html", `${path.split(/[\\/]/).slice(-2).join("-")}.html`);
  writeFileSync(source, html);
  await page.goto(url(source), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path });
}

export async function compose() {
  mkdirSync(join(RAW, "html"), { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const phone = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    const wide = await browser.newPage({ viewport: { width: 1024, height: 500 } });
    for (const locale of LOCALES) {
      const dir = join(OUT, "screenshots", locale);
      mkdirSync(dir, { recursive: true });
      for (const s of SLIDES) await render(phone, slide(s, locale), join(dir, `${s.id}.png`));
      await render(wide, feature(locale), join(OUT, `feature-graphic-${locale}.png`));
      console.log(`composed ${locale}`);
    }
  } finally {
    await browser.close();
  }
}
