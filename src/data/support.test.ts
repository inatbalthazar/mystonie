import { describe, expect, it } from "vitest";
import { signTip, verifyTip } from "./support";

const SECRET = "bmc_test_secret_0001";
const raw = JSON.stringify({ type: "donation.created", data: { supporter_email: "sam@example.com" } });

describe("verifyTip", () => {
  it("parses a body signed with the secret", () => {
    expect(verifyTip(raw, signTip(raw, SECRET), SECRET)).toEqual(JSON.parse(raw));
    expect(verifyTip(raw, signTip(raw, SECRET).toUpperCase(), SECRET)).toEqual(JSON.parse(raw));
  });

  it("refuses another secret, a changed body, or no signature", () => {
    expect(verifyTip(raw, signTip(raw, "another_secret_0001"), SECRET)).toBeNull();
    expect(verifyTip(raw.replace("sam", "kim"), signTip(raw, SECRET), SECRET)).toBeNull();
    expect(verifyTip(raw, null, SECRET)).toBeNull();
    expect(verifyTip(raw, "not-hex", SECRET)).toBeNull();
  });

  it("refuses a signed body that isn't JSON", () => {
    expect(verifyTip("nope", signTip("nope", SECRET), SECRET)).toBeNull();
  });
});
