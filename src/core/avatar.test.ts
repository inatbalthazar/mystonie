import { describe, expect, it } from "vitest";
import {
  avatarPath,
  centredFraming,
  clampFraming,
  cropSquare,
  enabledProviders,
  facebookPicture,
  isOwnAvatar,
  MAX_ZOOM,
  providerPhotoUrl,
  sniffImage,
  zoomFraming,
} from "./avatar";

const bytes = (...values: number[]) => new Uint8Array([...values, ...Array.from({ length: 16 }, () => 0)]);
const USER = "0192f000-0000-7000-8000-000000000001";
const STORAGE = "https://abc.supabase.co";

describe("sniffImage", () => {
  it("knows a JPEG, a PNG and a WebP by their first bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull(); // GIF
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeNull(); // a WAV
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("storage", () => {
  it("names a photo by its owner, its id and its type", () => {
    expect(avatarPath(USER, "p1", "webp")).toBe(`${USER}/p1.webp`);
    expect(avatarPath(USER, "p1", "jpeg")).toBe(`${USER}/p1.jpg`);
  });

  it("knows the person's own photos from anything else", () => {
    expect(isOwnAvatar(`${STORAGE}/storage/v1/object/public/avatars/${USER}/p1.webp`, USER, `${STORAGE}/`)).toBe(true);
    expect(isOwnAvatar(`${STORAGE}/storage/v1/object/public/avatars/someone-else/p1.webp`, USER, STORAGE)).toBe(false);
    expect(isOwnAvatar("https://lh3.googleusercontent.com/a/x=s96-c", USER, STORAGE)).toBe(false);
    expect(isOwnAvatar(null, USER, STORAGE)).toBe(false);
  });
});

describe("providers", () => {
  it("lists the switched-on providers in button order", () => {
    expect(enabledProviders({ external: { facebook: true, email: true, google: true, github: true } })).toEqual(["google", "facebook"]);
    expect(enabledProviders({ external: { google: false } })).toEqual([]);
    expect(enabledProviders(null)).toEqual([]);
  });

  it("asks Google for a bigger photo and keeps only https links", () => {
    expect(providerPhotoUrl("https://lh3.googleusercontent.com/a/ACg8oc=s96-c")).toBe("https://lh3.googleusercontent.com/a/ACg8oc=s320-c");
    expect(providerPhotoUrl("https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=1&ext=2&hash=3")).toContain("fbsbx.com");
    expect(providerPhotoUrl("http://example.com/me.jpg")).toBeNull();
    expect(providerPhotoUrl("javascript:alert(1)")).toBeNull();
    expect(providerPhotoUrl(5)).toBeNull();
  });

  it("reads Facebook's picture, unless it's the grey silhouette", () => {
    expect(facebookPicture({ data: { url: "https://scontent.xx.fbcdn.net/me.jpg", is_silhouette: false, width: 320 } })).toBe(
      "https://scontent.xx.fbcdn.net/me.jpg",
    );
    expect(facebookPicture({ data: { url: "https://scontent.xx.fbcdn.net/grey.jpg", is_silhouette: true } })).toBeNull();
    expect(facebookPicture({ error: { message: "bad token" } })).toBeNull();
  });
});

describe("framing a photo", () => {
  // A landscape picture, 1200 × 800, in a 256 px frame: at zoom 1 its height fits (scale 0.32).
  const W = 1200;
  const H = 800;
  const V = 256;

  it("starts centred, showing the middle square", () => {
    const f = centredFraming(W, H, V);
    expect(f).toEqual({ zoom: 1, x: (256 - 384) / 2, y: 0 });
    expect(cropSquare(W, H, V, f)).toEqual({ x: 200, y: 0, size: 800 });
  });

  it("never lets the picture leave a gap in the frame", () => {
    expect(clampFraming(W, H, V, { zoom: 1, x: 50, y: 30 })).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(clampFraming(W, H, V, { zoom: 1, x: -1000, y: -1000 })).toEqual({ zoom: 1, x: -128, y: 0 });
    expect(clampFraming(W, H, V, { zoom: 9, x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
    expect(clampFraming(W, H, V, { zoom: Number.NaN, x: Number.NaN, y: 0 })).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it("zooms around the centre", () => {
    const f = zoomFraming(W, H, V, centredFraming(W, H, V), 2);
    expect(f.zoom).toBe(2);
    expect(cropSquare(W, H, V, f)).toEqual({ x: 400, y: 200, size: 400 });
  });

  it("cuts what the frame shows after a move", () => {
    const f = clampFraming(W, H, V, { zoom: 1, x: 0, y: 0 });
    expect(cropSquare(W, H, V, f)).toEqual({ x: 0, y: 0, size: 800 });
  });
});
