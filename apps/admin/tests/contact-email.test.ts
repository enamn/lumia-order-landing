import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness } from "../src/modules/business/service";
import { startEmailVerification, confirmEmailVerification, contactEmailOf } from "../src/modules/business/contact-email";
import { getSubscription } from "../src/modules/billing/service";
const enabled = process.env.RUN_DB_TESTS === "true";

describe.skipIf(!enabled)("contact email verification", () => {
  const suffix = crypto.randomUUID().slice(0, 8); let owner: string, biz: string, mails: any[] = [], failMail = false;
  const lastCode = () => /(\d{6})/.exec(mails[mails.length - 1].text)![1]!;
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { if (new URL(url).pathname !== "/internal/email/send") return Response.json({}, { status: 404 }); if (failMail) return Response.json({ error: { code: "EMAIL_FAILED" } }, { status: 502 }); mails.push(JSON.parse(String(init.body))); return Response.json({ id: "em" }); }));
    owner = (await db.user.create({ data: { name: "ce", email: `${crypto.randomUUID()}@phone.lumia.invalid`, phoneNumber: "+97150555" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Burger House", locationName: "Main" }, "t")).id;
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("starts with no contact email, and says so in the subscription data", async () => {
    expect(await contactEmailOf(biz)).toEqual({ email: "", verified: false });
    expect((await getSubscription(owner, biz)).contactEmail).toEqual({ email: "", verified: false });
  });
  it("rejects an invalid address, and a failed send leaves nothing pending", async () => {
    await expect(startEmailVerification(owner, biz, { email: "nope" })).rejects.toBeTruthy();
    failMail = true; await expect(startEmailVerification(owner, biz, { email: "owner@example.com" })).rejects.toMatchObject({ code: "EMAIL_FAILED" }); failMail = false;
    expect(await db.emailChallenge.count({ where: { businessId: biz } })).toBe(0);
  });
  it("emails a code, stores it hashed, and verifies only with the right code", async () => {
    const r = await startEmailVerification(owner, biz, { email: "Owner@Example.com" }); expect(r).toMatchObject({ sent: true, resendAfter: 30 });
    expect(mails[0].to).toBe("owner@example.com"); expect(mails[0].subject).toMatch(/verification code/);
    expect((await db.emailChallenge.findUniqueOrThrow({ where: { businessId: biz } })).codeHash).not.toContain(lastCode());
    expect(await contactEmailOf(biz)).toEqual({ email: "owner@example.com", verified: false });
    await expect(confirmEmailVerification(owner, biz, { code: "12345" })).rejects.toBeTruthy();
    const wrong = lastCode() === "000000" ? "111111" : "000000";
    await expect(confirmEmailVerification(owner, biz, { code: wrong })).rejects.toMatchObject({ code: "INVALID_CODE" });
    expect(await confirmEmailVerification(owner, biz, { code: lastCode() })).toEqual({ email: "owner@example.com", verified: true });
    expect(await contactEmailOf(biz)).toEqual({ email: "owner@example.com", verified: true });
    expect(await db.emailChallenge.count({ where: { businessId: biz } })).toBe(0);
    await expect(confirmEmailVerification(owner, biz, { code: lastCode() })).rejects.toMatchObject({ code: "NO_CODE" });
  });
  it("does nothing for an address that is already verified, and un-verifies when the address changes", async () => {
    mails = []; expect(await startEmailVerification(owner, biz, { email: "owner@example.com" })).toMatchObject({ sent: false, alreadyVerified: true }); expect(mails.length).toBe(0);
    await startEmailVerification(owner, biz, { email: "new@example.com" }, new Date(Date.now() + 60_000));
    expect(await contactEmailOf(biz)).toEqual({ email: "new@example.com", verified: false });
  });
  it("limits resends, wrong guesses and code lifetime", async () => {
    await expect(startEmailVerification(owner, biz, { email: "new@example.com" })).rejects.toMatchObject({ code: "RATE_LIMITED" }); // within 30 seconds
    for (let i = 0; i < 5; i++) await confirmEmailVerification(owner, biz, { code: lastCode() === "000000" ? "111111" : "000000" }).catch(() => undefined);
    await expect(confirmEmailVerification(owner, biz, { code: lastCode() })).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
    await expect(confirmEmailVerification(owner, biz, { code: lastCode() }, new Date(Date.now() + 11 * 60_000))).rejects.toMatchObject({ code: "CODE_EXPIRED" });
  });
  it("changing the address in the profile settings un-verifies it", async () => {
    const { saveSettingsSection } = await import("../src/modules/settings/service");
    await db.business.update({ where: { id: biz }, data: { email: "v@example.com", emailVerifiedAt: new Date() } });
    const prof = (await import("../src/modules/settings/service")).getSettings; const cur = (await prof(owner, biz)).sections.profile;
    await saveSettingsSection(owner, biz, "profile", { ...cur, email: "v@example.com" }, "t"); expect((await contactEmailOf(biz)).verified).toBe(true);
    await saveSettingsSection(owner, biz, "profile", { ...cur, email: "other@example.com" }, "t"); expect(await contactEmailOf(biz)).toEqual({ email: "other@example.com", verified: false });
  });
});
