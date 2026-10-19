import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkTwilioCode, sendTwilioSms, twilioConfigured } from "../src/modules/auth/twilio-verify";
const env = { TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "token", TWILIO_VERIFY_SERVICE_SID: "VAtest" };
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
describe("Twilio Verify (SMS sign-in codes)", () => {
  beforeEach(() => { Object.assign(process.env, env); });
  afterEach(() => { vi.restoreAllMocks(); for (const k of Object.keys(env)) delete process.env[k]; });
  it("is only on when all three settings exist", () => {
    expect(twilioConfigured()).toBe(true);
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    expect(twilioConfigured()).toBe(false);
  });
  it("asks Twilio to send an SMS in the user's language", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(201, { status: "pending" }));
    await expect(sendTwilioSms("+971501234567", "ar")).resolves.toEqual({ deliveryLanguage: "ar" });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe("https://verify.twilio.com/v2/Services/VAtest/Verifications");
    expect(String((init!.body as URLSearchParams))).toBe("To=%2B971501234567&Channel=sms&Locale=ar");
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("ACtest:token").toString("base64")}`);
  });
  it("maps Twilio failures to clear errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(429, {})).mockResolvedValueOnce(reply(400, { code: 60200 })).mockResolvedValueOnce(reply(500, {}));
    await expect(sendTwilioSms("+971501234567")).rejects.toMatchObject({ code: "RESEND_TOO_SOON" });
    await expect(sendTwilioSms("+971501234567")).rejects.toMatchObject({ code: "PHONE_INVALID" });
    await expect(sendTwilioSms("+971501234567")).rejects.toMatchObject({ code: "SMS_SEND_FAILED" });
  });
  it("approves only a code Twilio approves", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(200, { status: "approved" })).mockResolvedValueOnce(reply(200, { status: "pending" })).mockResolvedValueOnce(reply(404, {})).mockResolvedValueOnce(reply(500, {}));
    expect(await checkTwilioCode("+971501234567", "123456")).toBe(true);
    expect(await checkTwilioCode("+971501234567", "000000")).toBe(false);
    expect(await checkTwilioCode("+971501234567", "123456")).toBe(false);
    await expect(checkTwilioCode("+971501234567", "123456")).rejects.toMatchObject({ code: "SMS_CHECK_FAILED" });
  });
});
