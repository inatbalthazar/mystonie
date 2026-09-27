// Ids for user rows (entries, episode logs, cards): UUID v7, made by the client so a row exists before it
// reaches the server (day-one rule, offline sync later). The database rejects any other version.
// Layout (RFC 9562): 48-bit Unix time in ms, version 7, 12 random bits, variant 10, 62 random bits.

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A new UUID v7. `now` and `random` are injectable for tests. */
export function uuidv7(
  now: number = Date.now(),
  random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (b) => crypto.getRandomValues(b),
): string {
  const bytes = random(new Uint8Array(16));
  let ms = Math.max(0, Math.floor(now));
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = 0x70 | (bytes[6] & 0x0f);
  bytes[8] = 0x80 | (bytes[8] & 0x3f);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuidV7(id: string): boolean {
  return V7.test(id);
}
