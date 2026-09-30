import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/server/crypto";
import { COUNTRIES, countryOf, maskPhone } from "../src/modules/auth/countries";
import { sendCodeSchema } from "../src/modules/auth/phone";
describe("token encryption", () => {
  const saved = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  beforeEach(() => { process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); });
  afterEach(() => { if (saved === undefined) delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY; else process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = saved; });
  it("round-trips, never stores plaintext, and uses a fresh IV each time", () => {
    const a = encryptSecret("EAAB-secret-token"), b = encryptSecret("EAAB-secret-token");
    expect(a).not.toContain("EAAB"); expect(a).not.toBe(b); expect(decryptSecret(a)).toBe("EAAB-secret-token");
  });
  it("rejects tampering and refuses to run without a 32-byte key", () => {
    const parts = encryptSecret("x").split("."); parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrowError();
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = "short";
    expect(() => encryptSecret("x")).toThrowError(/Secure storage/);
  });
});
describe("supported countries", () => {
  it("validates national numbers per country and masks for display", () => {
    expect(countryOf("+971501234567")?.label).toBe("UAE"); expect(countryOf("+971 501234567")).toBeUndefined();
    expect(countryOf("+971512345678")).toBeUndefined(); // 51 is not a UAE mobile prefix
    expect(countryOf("+966512345678")?.label).toBe("Saudi"); expect(countryOf("+15551234567")).toBeUndefined();
    expect(maskPhone("+971501234567")).toBe("+971 50 XXX 4567"); expect(COUNTRIES).toHaveLength(9);
  });
  it("send-code schema accepts supported numbers, defaults channel to whatsapp and rejects others", () => {
    expect(sendCodeSchema.parse({ phoneNumber: "+971501234567" })).toMatchObject({ language: "en", channel: "whatsapp" });
    expect(sendCodeSchema.parse({ phoneNumber: "+447400123456", channel: "sms" }).channel).toBe("sms");
    expect(() => sendCodeSchema.parse({ phoneNumber: "+15551234567" })).toThrow();
    expect(() => sendCodeSchema.parse({ phoneNumber: "+971501234567", channel: "fax" })).toThrow();
  });
});
