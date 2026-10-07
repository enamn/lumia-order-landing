import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness } from "../src/modules/business/service";
import { recordInbound } from "../src/modules/messages/inbound";
import { requireAccess, accessFor } from "../src/modules/billing/service";
import { runReminders } from "../src/modules/billing/reminders";
const enabled = process.env.RUN_DB_TESTS === "true";
const DAY = 86_400_000;

describe.skipIf(!enabled)("trial and plan expiry", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5592${Date.now().toString().slice(-9)}`;
  let owner: string, biz: string, calls: { path: string; body: any }[]; let n = 0;
  const emails = () => calls.filter(c => c.path === "/internal/email/send").map(c => c.body);
  const ai = () => calls.filter(c => c.path === "/internal/ai/reply");
  const ageTrial = (days: number) => db.business.update({ where: { id: biz }, data: { createdAt: new Date(Date.now() - days * DAY) } });
  const say = (text: string) => recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.lo.${suffix}.${++n}`, senderId: "971501009999", timestamp: String(Math.floor(Date.now() / 1000)), senderName: "Sara", type: "text", textBody: text } as any] });
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname, body = JSON.parse(String(init.body)); calls.push({ path, body });
      if (path === "/internal/email/send") return Response.json({ id: "em_1" });
      if (path === "/internal/whatsapp/send") return Response.json({ messageId: `wamid.out.lo.${suffix}.${++n}` });
      if (path === "/internal/ai/reply") return Response.json({ intent: "other", language: "en", reply: "Hello!", needsHuman: false, order: null });
      return Response.json({}, { status: 404 });
    }));
    owner = (await db.user.create({ data: { name: "lo", email: `lo-${suffix}@example.com`, phoneNumber: "+97150444" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Burger House", locationName: "Main" }, "t")).id;
    await db.business.update({ where: { id: biz }, data: { email: `lo-${suffix}@example.com`, emailVerifiedAt: new Date() } });
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990015", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    calls = [];
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("during the trial everything works and nothing is sent early", async () => {
    await ageTrial(5); calls = [];
    await requireAccess(owner, biz); await runReminders();
    expect(emails().filter(e => e.to === `lo-${suffix}@example.com`)).toEqual([]);
    await say("hi"); expect(ai().length).toBe(1);
  });
  it("emails the owner 3 days and 1 day before the trial ends, once each", async () => {
    await ageTrial(12); calls = [];
    await runReminders(); await runReminders();
    let mine = emails().filter(e => e.to === `lo-${suffix}@example.com`);
    expect(mine.length).toBe(1); expect(mine[0].subject).toBe("Your free trial ends in 3 days");
    await ageTrial(13); calls = []; await runReminders();
    expect(emails().filter(e => e.to === `lo-${suffix}@example.com`)).toEqual([]); // one email a day: the next reminder waits for tomorrow
    await db.billingNotice.updateMany({ where: { businessId: biz }, data: { sentAt: new Date(Date.now() - 2 * DAY) } }); calls = []; await runReminders();
    mine = emails().filter(e => e.to === `lo-${suffix}@example.com`); expect(mine.map(e => e.subject)).toEqual(["Your free trial ends tomorrow"]);
  });
  it("emails only a verified contact email, never a placeholder or an unverified one", async () => {
    await ageTrial(12); await db.billingNotice.deleteMany({ where: { businessId: biz } });
    await db.business.update({ where: { id: biz }, data: { emailVerifiedAt: null } }); calls = [];
    await runReminders(); expect(emails().map(e => e.to)).not.toContain(`lo-${suffix}@example.com`); // unverified: nobody to tell, and the reminder is not marked as sent
    await db.business.update({ where: { id: biz }, data: { emailVerifiedAt: new Date() } }); calls = [];
    await runReminders(); expect(emails().map(e => e.to)).toContain(`lo-${suffix}@example.com`);
    await db.billingNotice.deleteMany({ where: { businessId: biz } });
  });
  it("locks the dashboard and silences the assistant once the trial is over, and says so by email", async () => {
    await ageTrial(15); calls = [];
    expect((await accessFor(biz)).active).toBe(false);
    await expect(requireAccess(owner, biz)).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUIRED", status: 402 });
    await runReminders(); expect(emails().filter(e => e.to === `lo-${suffix}@example.com`).map(e => e.subject)).toEqual(["Your free trial has ended"]);
    const before = await db.message.count({ where: { conversation: { businessId: biz } } });
    await say("hello?"); expect(ai().length).toBe(0); expect(calls.some(c => c.path === "/internal/whatsapp/send")).toBe(false);
    expect(await db.message.count({ where: { conversation: { businessId: biz } } })).toBe(before + 1); // still stored for the owner
  });
  it("keeps everything on while a failed renewal is retried, then locks when the plan ends", async () => {
    const sub = await db.subscription.create({ data: { businessId: biz, plan: "plus", billing: "monthly", status: "PAST_DUE", failedAttempts: 1, nextChargeAt: new Date(Date.now() + DAY), currentPeriodStart: new Date(Date.now() - 30 * DAY), currentPeriodEnd: new Date(Date.now() - DAY), startedAt: new Date(Date.now() - 60 * DAY) } });
    calls = []; await requireAccess(owner, biz); await say("still there?"); expect(ai().length).toBe(1);
    await db.billingNotice.updateMany({ where: { businessId: biz }, data: { sentAt: new Date(Date.now() - 2 * DAY) } }); // the trial emails went out on earlier days
    await runReminders(); await runReminders(); expect(emails().filter(e => e.to === `lo-${suffix}@example.com`).map(e => e.subject)).toEqual(["We couldn’t renew your plan"]);
    await db.subscription.update({ where: { id: sub.id }, data: { status: "ENDED", nextChargeAt: null } }); calls = [];
    await expect(requireAccess(owner, biz)).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUIRED" });
    await say("anyone?"); expect(ai().length).toBe(0);
    await runReminders(); expect(emails().filter(e => e.to === `lo-${suffix}@example.com`).map(e => e.subject)).toEqual(["Your plan has ended"]);
  });
  it("a paid plan unlocks it again", async () => {
    await db.subscription.updateMany({ where: { businessId: biz }, data: { status: "ACTIVE", failedAttempts: 0, currentPeriodEnd: new Date(Date.now() + 20 * DAY), nextChargeAt: new Date(Date.now() + 20 * DAY) } });
    await requireAccess(owner, biz); calls = []; await say("back?"); expect(ai().length).toBe(1);
  });
});
