import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { createBusiness, setMember } from "../src/modules/business/service";
import { getSettings, saveSettingsSection } from "../src/modules/settings/service";
const enabled = process.env.RUN_DB_TESTS === "true";

describe.skipIf(!enabled)("restaurant settings", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  let owner: string, viewer: string, biz: string;
  const save = (section: string, data: unknown, user = owner) => saveSettingsSection(user, biz, section, data, "t");
  beforeAll(async () => {
    await ensureMongoIndexes();
    const mk = (nm: string, i: number) => db.user.create({ data: { name: nm, email: `${nm}-${suffix}@test.invalid`, phoneNumber: `+97150777${String(2000 + i)}`, phoneNumberVerified: true } });
    [owner, viewer] = (await Promise.all([mk("own", 1), mk("vie", 2)])).map(u => u.id);
    biz = (await createBusiness(owner, { name: "Settings Burgers", locationName: "Main" }, "t")).id;
    await setMember(owner, biz, { phoneNumber: "+971507772002", role: "VIEWER" }, "t");
  });
  afterAll(async () => { await db.$disconnect(); });

  it("starts from the existing business data", async () => {
    const s = await getSettings(owner, biz);
    expect(s.sections.profile).toMatchObject({ brand: "Settings Burgers", name: "Settings Burgers", vat: false, lang: "both", greet: "friendly", logo: null });
    expect(s.sections.branches).toHaveLength(1); expect(s.sections.branches[0]).toMatchObject({ name: "Main", active: true, pin: false });
    expect(s.sections.hours.same).toHaveLength(7); expect(s.menu).toMatchObject({ items: 0, categories: 0 }); expect(s.canEdit).toBe(true);
  });
  it("saves the profile into the business and keeps the extras", async () => {
    const p = { ...(await getSettings(owner, biz)).sections.profile, name: "Settings Burgers LLC", brand: "Settings House", cuisine: "Burgers", phone: "+971 6 555 0142", email: "hi@settings.test", vat: true, trn: "100234567800003", greet: "formal" };
    const r = await save("profile", p);
    expect(r.value).toMatchObject({ brand: "Settings House", name: "Settings Burgers LLC", phone: "+97165550142", greet: "formal", trn: "100234567800003" });
    expect(await db.business.findUniqueOrThrow({ where: { id: biz } })).toMatchObject({ name: "Settings House", phone: "+97165550142", vatRegistered: true, taxRegistrationNumber: "100234567800003" });
    await expect(save("profile", { ...p, trn: "123" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(save("profile", { ...p, phone: "0501234567" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(save("profile", { ...p, extra: 1 })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
  it("adds, pins and deactivates branches", async () => {
    const cur = (await getSettings(owner, biz)).sections.branches;
    const next = [{ ...cur[0], pin: true, coords: "25.3302, 55.3901", area: "Al Majaz", eta: "50" }, { id: "tmp-1", name: "Ajman Branch", emirate: "Ajman", area: "Nuaimiya", address: "Sheikh Khalifa St", phone: "", eta: "60", active: true, pin: false, coords: "" }];
    const r = await save("branches", next);
    const list = r.value as any[]; expect(list).toHaveLength(2); expect(list[1].id).not.toBe("tmp-1"); expect(list[0]).toMatchObject({ pin: true, coords: "25.3302, 55.3901", eta: "50" });
    expect((await db.location.findMany({ where: { businessId: biz }, include: { hours: true } })).every(l => l.hours.length === 7)).toBe(true);
    await expect(save("branches", [{ ...list[0], pin: true, coords: "not coordinates" }])).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(save("branches", [])).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const off = await save("branches", list.map((b, i) => (i === 1 ? { ...b, active: false } : b)));
    expect((off.value as any[])[1].active).toBe(false);
  });
  it("applies delivery rules to what the AI reads and rejects overlapping distance ranges", async () => {
    const d = (await getSettings(owner, biz)).sections.delivery as any;
    await save("delivery", { ...d, status: "pickup", method: "manual", minOrder: "30" });
    expect(await db.orderSettings.findUniqueOrThrow({ where: { businessId: biz } })).toMatchObject({ supportsDelivery: false, supportsPickup: true, minimumOrderAmountMinor: 3000 });
    await save("delivery", { ...d, status: "available", method: "area", minOrder: "12.5" });
    expect((await db.orderSettings.findUniqueOrThrow({ where: { businessId: biz } }))).toMatchObject({ supportsDelivery: true, minimumOrderAmountMinor: 1250 });
    const overlap = [{ from: "0", to: "5", fee: "5", min: "", eta: "", on: true }, { from: "3", to: "", fee: "9", min: "", eta: "", on: true }];
    await expect(save("delivery", { ...d, method: "distance", ranges: overlap })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
  it("writes working hours to every branch, Monday-first in the design and Sunday = 0 in the table", async () => {
    const h = (await getSettings(owner, biz)).sections.hours as any;
    const same = h.same.map((r: any) => (r.day === "Friday" ? { ...r, open: false } : { ...r, from: "11:00", to: "23:00" }));
    await save("hours", { ...h, mode: "custom", scope: "same", same });
    for (const l of await db.location.findMany({ where: { businessId: biz }, include: { hours: true } })) {
      expect(l.hours).toHaveLength(7);
      expect(l.hours.find(x => x.dayOfWeek === 5)).toMatchObject({ isClosed: true }); // Friday
      expect(l.hours.find(x => x.dayOfWeek === 0)).toMatchObject({ isClosed: false, openTime: "11:00", closeTime: "23:00" }); // Sunday
    }
    await expect(save("hours", { ...h, same: [] })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
  it("stores routing and payments, refuses unknown pages and non-managers", async () => {
    await save("pay", { cod: true, verify: true, threshold: "200" });
    expect((await getSettings(owner, biz)).sections.pay).toEqual({ cod: true, verify: true, threshold: "200" });
    await expect(save("nope", {})).rejects.toMatchObject({ status: 404 });
    await expect(save("pay", { cod: false, verify: false, threshold: "1" }, viewer)).rejects.toMatchObject({ status: 403 });
    expect((await getSettings(viewer, biz)).canEdit).toBe(false);
  });
});
