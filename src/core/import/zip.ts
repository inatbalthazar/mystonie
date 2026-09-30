// Reads the text files out of a ZIP archive (a Letterboxd or TV Time export is a .zip, S2 Letterboxd import), so nobody has to
// unzip it first, which is hard on a phone. Only what an export needs: stored or deflated entries, no ZIP64, no
// encryption. Deflate itself is passed in (`DecompressionStream("deflate-raw")` in the browser, zlib in tests),
// which keeps this file free of platform APIs.

export type InflateRaw = (compressed: Uint8Array) => Promise<Uint8Array>;

type Entry = { name: string; method: number; offset: number; compressedSize: number };

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** Whether the bytes start like a ZIP archive ("PK\3\4", or "PK\5\6" for an empty one). */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5);
}

/** The archive's file entries from its central directory, or null when it isn't a ZIP we can read. */
function entries(bytes: Uint8Array): Entry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record is in the last 22 bytes plus a comment of up to 64 KB.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const found: Entry[] = [];
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL) return null;
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const encrypted = (flags & 1) === 1;
    if (!encrypted && compressedSize !== 0xffffffff && !name.endsWith("/")) found.push({ name, method, offset, compressedSize });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return found;
}

/**
 * The text of every file whose path `wanted` accepts, by path. Null when the bytes aren't a readable ZIP. A file
 * that can't be read (an unknown compression method, a broken entry) is left out.
 */
export async function readZipTexts(
  bytes: Uint8Array,
  wanted: (path: string) => boolean,
  inflateRaw: InflateRaw,
): Promise<Map<string, string> | null> {
  const list = entries(bytes);
  if (!list) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const texts = new Map<string, string>();
  for (const entry of list) {
    if (!wanted(entry.name)) continue;
    const at = entry.offset;
    if (at + 30 > bytes.length || view.getUint32(at, true) !== LOCAL) continue;
    const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
    const data = bytes.subarray(start, start + entry.compressedSize);
    if (data.length !== entry.compressedSize) continue;
    try {
      if (entry.method === 0) texts.set(entry.name, decoder.decode(data));
      else if (entry.method === 8) texts.set(entry.name, decoder.decode(await inflateRaw(data)));
    } catch {
      // A broken entry: skip it, the others may still do.
    }
  }
  return texts;
}

/** Whether the bytes are gzip (a MyAnimeList export is `….xml.gz`). */
export function looksLikeGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

let crcTable: Uint32Array | null = null;

/** CRC-32 (ISO 3309), which every ZIP entry carries. */
export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A ZIP of text files, stored without compression (S3 CSV export): a few hundred KB of CSV for a big collection, so
 * compressing isn't worth code. `at` dates the entries. Names are UTF-8 (flag bit 11).
 */
export function writeZip(files: Record<string, string>, at: Date): Uint8Array {
  const encoder = new TextEncoder();
  const time = (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (at.getUTCSeconds() >> 1);
  const date = ((Math.max(1980, at.getUTCFullYear()) - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = encoder.encode(path);
    const data = encoder.encode(text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, CENTRAL, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, EOCD, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let written = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, written);
    written += part.length;
  }
  return out;
}
