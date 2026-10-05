import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/server/db";
import { ensureMongoIndexes } from "../scripts/mongo-indexes";
import { encryptSecret } from "../src/server/crypto";
import { createBusiness } from "../src/modules/business/service";
import { recordInbound } from "../src/modules/messages/inbound";
import { setAiSettings } from "../src/modules/messages/ai";
import { quoteDelivery, emirateFrom, distanceKm, branchFromText, looksLikeAddress, type DeliveryRules, type BranchPoint } from "../src/modules/orders/delivery";
import { draftKey, resolveDraft, summaryText, isComplete, type MenuEntry } from "../src/modules/orders/draft";
const enabled = process.env.RUN_DB_TESTS === "true";

const rules = (over: Partial<DeliveryRules> = {}): DeliveryRules => ({ status: "available", method: "area", minOrder: "30", freeAbove: "", eta: "45", pinReq: true, freeEm: ["Sharjah"], freeAreas: "All areas", freeBranch: "b1", manualMsg: "", confirmFirst: true,
  areas: [{ emirate: "Sharjah", area: "Al Majaz", fee: "10", min: "40", eta: "30", branch: "b1", on: true }, { emirate: "Sharjah", area: "All areas", fee: "15", min: "", eta: "", branch: "", on: true }, { emirate: "Ajman", area: "All areas", fee: "20", min: "", eta: "60", branch: "b2", on: true }, { emirate: "Dubai", area: "All areas", fee: "", min: "", eta: "", branch: "", on: false }],
  ranges: [{ from: "0", to: "5", fee: "5", min: "30", eta: "35", on: true }, { from: "5", to: "10", fee: "10", min: "40", eta: "50", on: true }, { from: "10", to: "", fee: "15", min: "50", eta: "70", on: false }], ...over });
const branches: BranchPoint[] = [{ id: "b1", name: "Sharjah", active: true, latitude: 25.3302, longitude: 55.3901 }, { id: "b2", name: "Ajman", active: true, latitude: 25.4052, longitude: 55.4467 }, { id: "b3", name: "No pin", active: true, latitude: null, longitude: null }];
const place = (emirate: string | null, area = "", pin?: { latitude: number; longitude: number }) => ({ emirate, area, ...(pin ?? {}) });

describe("finding the branch without a location pin", () => {
  it("reads the restaurant's own area rules from what the customer wrote, English or Arabic", () => {
    expect(branchFromText(rules(), branches, "I am in Al Majaz, Sharjah")).toBe("b1"); // a specific area rule that names a branch
    expect(branchFromText(rules(), branches, "Nuaimiya Ajman building 4")).toBe("b2"); // only the emirate matched: its "All areas" rule names the branch
    expect(branchFromText(rules(), branches, "في عجمان")).toBe("b2");
    expect(branchFromText(rules(), branches, "somewhere in Sharjah")).toBeNull(); // that rule names no branch
    expect(branchFromText(rules(), branches, "hello")).toBeNull();
    expect(branchFromText(rules({ method: "distance" }), branches, "Al Majaz")).toBeNull(); // distance pricing needs a pin
    expect(branchFromText(rules({ method: "free" }), branches, "Sharjah")).toBe("b1"); // free delivery names one branch
    expect(branchFromText(rules(), branches.map(b => (b.id === "b1" ? { ...b, active: false } : b)), "Al Majaz")).toBeNull(); // a switched-off branch is never chosen
    expect(branchFromText(null, branches, "Al Majaz")).toBeNull();
  });
  it("tells an address from small talk before it is looked up on a map", () => {
    for (const t of ["Opus tower 804 Business Bay", "Villa 12 Al Majaz", "برج الخليج شارع 5", "behind the mall"]) expect(looksLikeAddress(t)).toBe(true);
    for (const t of ["hello", "yes please", "2 burgers", "نعم", "ok thanks"]) expect(looksLikeAddress(t)).toBe(false);
  });
});

describe("delivery fee rules", () => {
  it("finds the emirate in English or Arabic text", () => {
    expect(emirateFrom("Dubai")).toBe("Dubai"); expect(emirateFrom(null, "Al Majaz, الشارقة")).toBe("Sharjah"); expect(emirateFrom("بناية 4، أبو ظبي")).toBe("Abu Dhabi"); expect(emirateFrom("ras al khaimah")).toBe("Ras Al Khaimah"); expect(emirateFrom("Somewhere")).toBeNull();
  });
  it("by area: the most specific active rule wins, with its own minimum, ETA and branch; unknown emirate asks for it; unserved places are refused", () => {
    expect(quoteDelivery(rules(), branches, place("Sharjah", "Al Majaz"), 5000, 0)).toMatchObject({ status: "ok", feeMinor: 1000, minimumMinor: 4000, etaMinutes: 30, branchId: "b1" });
    expect(quoteDelivery(rules(), branches, place("Sharjah", "Al Khan"), 5000, 0)).toMatchObject({ feeMinor: 1500, minimumMinor: 3000, etaMinutes: 45 }); // the "All areas" rule, restaurant defaults
    expect(quoteDelivery(rules(), branches, place("Ajman"), 5000, 0)).toMatchObject({ feeMinor: 2000, etaMinutes: 60, branchId: "b2" });
    expect(quoteDelivery(rules(), branches, place(null), 5000, 0)).toEqual({ status: "needs", need: "area" });
    expect(quoteDelivery(rules(), branches, place("Dubai"), 5000, 0)).toMatchObject({ status: "outside", reason: "area" }); // switched off
    expect(quoteDelivery(rules(), branches, place("Fujairah"), 5000, 0)).toMatchObject({ status: "outside" });
  });
  it("by distance: needs the location pin, uses the nearest branch with a pin and its range", () => {
    const r = rules({ method: "distance" });
    expect(quoteDelivery(r, branches, place("Sharjah", "Al Majaz"), 5000, 0)).toEqual({ status: "needs", need: "pin" });
    const near = { latitude: 25.3402, longitude: 55.3901 }; // ~1.1 km north of the Sharjah branch
    expect(quoteDelivery(r, branches, place(null, "", near), 5000, 0)).toMatchObject({ status: "ok", feeMinor: 500, etaMinutes: 35, branchId: "b1", distanceKm: 1.1 });
    expect(quoteDelivery(r, branches, place(null, "", { latitude: 25.3302, longitude: 55.4501 }), 5000, 0)).toMatchObject({ feeMinor: 1000, branchId: "b1" }); // ~6 km
    expect(quoteDelivery(r, branches, place(null, "", { latitude: 25.3302, longitude: 55.6201 }), 5000, 0)).toMatchObject({ status: "outside", reason: "range" }); // ~20 km, the last range is off
    expect(Math.round(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }))).toBe(111);
  });
  it("free delivery, manual confirmation, free above an amount, and delivery switched off", () => {
    expect(quoteDelivery(rules({ method: "free" }), branches, place("Sharjah"), 5000, 0)).toMatchObject({ status: "ok", feeMinor: 0, free: true, branchId: "b1" });
    expect(quoteDelivery(rules({ method: "free" }), branches, place("Ajman"), 5000, 0)).toMatchObject({ status: "outside", reason: "emirate" });
    expect(quoteDelivery(rules({ method: "manual" }), branches, place(null), 5000, 0)).toMatchObject({ status: "ok", manual: true, feeMinor: 0 });
    expect(quoteDelivery(rules({ freeAbove: "100" }), branches, place("Ajman"), 10000, 0)).toMatchObject({ feeMinor: 0, free: true }); expect(quoteDelivery(rules({ freeAbove: "100" }), branches, place("Ajman"), 9999, 0)).toMatchObject({ feeMinor: 2000 });
    expect(quoteDelivery(rules({ status: "pickup" }), branches, place("Sharjah"), 5000, 0)).toEqual({ status: "unavailable", reason: "PICKUP_ONLY" }); expect(quoteDelivery(rules({ status: "paused" }), branches, place("Sharjah"), 5000, 0)).toEqual({ status: "unavailable", reason: "PAUSED" });
    expect(quoteDelivery(null, branches, place(null), 5000, 1500)).toMatchObject({ status: "ok", feeMinor: 0, minimumMinor: 1500 }); // delivery never configured: as before, no fee
  });
});

describe("order summary with a delivery fee", () => {
  const menu: MenuEntry[] = [{ index: "1", itemId: "a", name: "Classic", nameAr: "كلاسيك", priceMinor: 2800, available: true }];
  const opts = { delivery: true, pickup: true, minimumMinor: 0 }, items = [{ id: "1", quantity: 2, notes: "" }];
  const ctx = (r: DeliveryRules | null = rules(), profileName = "Sara Khalid") => ({ rules: r, branches, profileName });
  it("shows subtotal, delivery fee, final total, name and ETA, and needs the name and a fee before it is complete", () => {
    const r = resolveDraft(menu, { items, fulfillment: "delivery", address: "Al Majaz St 5", emirate: "Sharjah", area: "Al Majaz", customerName: "", addressLabel: "Home" }, opts, ctx());
    expect(r).toMatchObject({ subtotalMinor: 5600, feeMinor: 1000, totalMinor: 6600, name: "Sara Khalid", emirate: "Sharjah" }); expect(isComplete(r)).toBe(true);
    const text = summaryText(r, "en", opts);
    expect(text).toContain("Subtotal: 56 AED"); expect(text).toContain("Delivery fee: 10 AED"); expect(text).toContain("Total: 66 AED"); expect(text).toContain("For: Sara Khalid"); expect(text).toContain("about 30 minutes"); expect(text).toContain("Reply YES");
    expect(summaryText(r, "ar", opts)).toContain("رسوم التوصيل: 10 AED");
    expect(isComplete(resolveDraft(menu, { items, fulfillment: "delivery", address: "Al Majaz St 5", emirate: "Sharjah", area: "Al Majaz", customerName: "", addressLabel: "Home" }, opts, ctx(rules(), "")))).toBe(false); // no name yet
    const noFee = resolveDraft(menu, { items, fulfillment: "delivery", address: "Somewhere", emirate: null, area: "", customerName: "" }, opts, ctx());
    expect(noFee.delivery).toEqual({ status: "needs", need: "area" }); expect(isComplete(noFee)).toBe(false); expect(summaryText(noFee, "en", opts)).not.toContain("Reply YES");
    const outside = resolveDraft(menu, { items, fulfillment: "delivery", address: "Fujairah Corniche", emirate: "Fujairah", area: "", customerName: "" }, opts, ctx());
    expect(summaryText(outside, "en", opts)).toContain("we don't deliver to Fujairah"); expect(isComplete(outside)).toBe(false);
    expect(summaryText(resolveDraft(menu, { items, fulfillment: "delivery", address: "x street", emirate: "Sharjah", area: "Al Majaz", customerName: "" }, { ...opts, minimumMinor: 0 }, ctx(rules({ method: "manual" }))), "en", opts)).toContain("The restaurant will confirm the delivery fee");
  });
  it("a confirmation only counts for what was shown: a different fee, total or name changes the key", () => {
    const base = { items, fulfillment: "delivery" as const, address: "Al Majaz St 5", emirate: "Sharjah", area: "Al Majaz", customerName: "", addressLabel: "Home" };
    const a = draftKey(resolveDraft(menu, base, opts, ctx())), b = draftKey(resolveDraft(menu, { ...base, area: "Al Khan" }, opts, ctx())), c = draftKey(resolveDraft(menu, base, opts, ctx(rules(), "Omar")));
    expect(new Set([a, b, c]).size).toBe(3); expect(draftKey(resolveDraft(menu, base, opts, ctx()))).toBe(a);
  });
});

describe("address labels", () => {
  const menu: MenuEntry[] = [{ index: "1", itemId: "a", name: "Classic", nameAr: "كلاسيك", priceMinor: 2800, available: true }];
  const opts = { delivery: true, pickup: true, minimumMinor: 0 }, items = [{ id: "1", quantity: 1, notes: "" }];
  const saved = [{ id: "1", label: "Work", text: "Opus tower 804", emirate: "Sharjah", area: "Al Majaz", latitude: 25.3402, longitude: 55.3901 }, { id: "2", label: "Home", text: "Villa 3", emirate: "Ajman", area: "", latitude: null, longitude: null }];
  const ctx = { rules: rules(), branches, profileName: "Sara Khalid", saved };
  it("Home and Work are recognised in English and Arabic, other names are kept", async () => {
    const { normalizeLabel } = await import("../src/modules/orders/draft");
    for (const w of ["home", "Home ", "البيت", "المنزل"]) expect(normalizeLabel(w)).toBe("Home"); for (const w of ["work", "Office", "عمل", "العمل", "مكتب"]) expect(normalizeLabel(w)).toBe("Work");
    expect(normalizeLabel("  Mum's   house ")).toBe("Mum's house"); expect(normalizeLabel("")).toBe(""); expect(normalizeLabel("x".repeat(80))).toHaveLength(30);
  });
  it("a delivery order is not complete until the address has a name, and the summary shows it", () => {
    const d = { items, fulfillment: "delivery" as const, address: "Al Majaz St 5", emirate: "Sharjah", area: "Al Majaz", customerName: "" };
    expect(isComplete(resolveDraft(menu, { ...d, addressLabel: "" }, opts, ctx))).toBe(false);
    const w = resolveDraft(menu, { ...d, addressLabel: "عمل" }, opts, ctx); expect(w.label).toBe("Work"); expect(isComplete(w)).toBe(true);
    expect(summaryText(w, "en", opts)).toContain("Delivery to (Work): Al Majaz St 5"); expect(summaryText(w, "ar", opts)).toContain("التوصيل إلى (العمل):");
  });
  it("picking a saved address uses its text, area, emirate and pin, so nothing else is asked", () => {
    const r = resolveDraft(menu, { items, fulfillment: "delivery", address: "", emirate: null, area: "", customerName: "", addressLabel: "", savedAddress: "1" }, opts, ctx);
    expect(r).toMatchObject({ address: "Opus tower 804", emirate: "Sharjah", area: "Al Majaz", label: "Work", savedId: "1", feeMinor: 1000 }); expect(isComplete(r)).toBe(true);
    const byDistance = resolveDraft(menu, { items, fulfillment: "delivery", address: "", emirate: null, area: "", customerName: "", addressLabel: "", savedAddress: "1" }, opts, { ...ctx, rules: rules({ method: "distance" }) });
    expect(byDistance).toMatchObject({ feeMinor: 500, pin: { latitude: 25.3402, longitude: 55.3901 } }); // the saved pin prices it
    const noPin = resolveDraft(menu, { items, fulfillment: "delivery", address: "", emirate: null, area: "", customerName: "", addressLabel: "", savedAddress: "2" }, opts, { ...ctx, rules: rules({ method: "distance" }) });
    expect(noPin.delivery).toEqual({ status: "needs", need: "pin" }); // that saved address has no pin
    expect(resolveDraft(menu, { items, fulfillment: "delivery", address: "Elsewhere", emirate: "Dubai", area: "", customerName: "", addressLabel: "Home", savedAddress: "99" }, opts, ctx).savedId).toBe(""); // unknown id: ignored
  });
});

describe.skipIf(!enabled)("taking a delivery order over WhatsApp, priced by location", () => {
  const suffix = crypto.randomUUID().slice(0, 8); const PNID = `5590${Date.now().toString().slice(-9)}`;
  let owner: string, biz: string, branchId: string; let calls: { path: string; body: any }[]; let ai: any; let n = 0; let out = 0;
  let geoFound: any = { found: false }, reviewOn = false, rejectKind = false; // what the map lookup finds, whether the review template is accepted, whether WhatsApp refuses interactive messages
  const inbound = (extra: object, from = "971504074115", name = "Sara Khalid") => recordInbound({ messages: [{ phoneNumberId: PNID, messageId: `wamid.${suffix}.${++n}`, senderId: from, timestamp: String(Math.floor(Date.now() / 1000)), senderName: name, ...extra } as any] });
  const say = (text: string, from?: string) => inbound({ type: "text", textBody: text }, from);
  const sent = () => calls.filter(c => c.path === "/internal/whatsapp/send").map(c => c.body.text as string);
  const lastAi = () => calls.filter(c => c.path === "/internal/ai/reply").at(-1)!.body;
  const turn = async (run: () => Promise<unknown>, make: (id: (n: string) => string) => any) => { calls = []; ai = { __make: make }; await run(); return sent().at(-1) ?? ""; };
  const draft = (id: (n: string) => string, extra: object = {}) => ({ intent: "order_request", language: "en", reply: "Sure!", needsHuman: false, order: { items: [{ id: id("Classic"), quantity: 2, notes: "" }], fulfillment: "delivery", address: "", emirate: null, area: "", customerName: "", addressLabel: "Home", savedAddress: "", confirmed: false, ...extra } });
  const setRules = (r: Partial<DeliveryRules> & { method: DeliveryRules["method"] }) => db.business.update({ where: { id: biz }, data: { settings: { delivery: rules(r as any) } as any } });
  beforeAll(async () => {
    await ensureMongoIndexes();
    process.env.LUMIA_API_URL = "http://api.test"; process.env.INTERNAL_API_KEY = "k".repeat(32); process.env.WHATSAPP_LINK_TEST_MODE = "false"; process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname; const body = JSON.parse(String(init.body)); calls.push({ path, body });
      if (path === "/internal/ai/reply") { if (ai.__fail) return Response.json({ error: { code: "AI_FAILED" } }, { status: 502 }); const ids = (nm: string) => body.menu.find((m: any) => m.name === nm)?.id; return Response.json(ai.__make(ids)); }
      if (path === "/internal/geo/search") return Response.json(geoFound);
      if (path === "/internal/whatsapp/order-review") return reviewOn ? Response.json({ messageId: `wamid.rev.${suffix}.${++out}` }) : Response.json({ error: { code: "WHATSAPP_SEND_FAILED" } }, { status: 502 });
      if (path === "/internal/whatsapp/send" && body.kind && rejectKind) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
      if (path === "/internal/geo/reverse") return Response.json({ emirate: "Sharjah", area: "Al Majaz", street: "Al Majaz St", place: "", formatted: "Al Majaz St, Al Majaz, Sharjah" });
      return Response.json({ messageId: `wamid.out.${suffix}.${++out}` });
    }));
    owner = (await db.user.create({ data: { name: "own", email: `own-${suffix}@test.invalid`, phoneNumber: "+97150555" + String(Date.now()).slice(-4), phoneNumberVerified: true } })).id;
    biz = (await createBusiness(owner, { name: "Delivery Burgers", locationName: "Sharjah" }, "t")).id;
    const loc = await db.location.findFirstOrThrow({ where: { businessId: biz } }); branchId = loc.id;
    await db.location.update({ where: { id: loc.id }, data: { latitude: 25.3302, longitude: 55.3901 } });
    await db.whatsAppAccount.create({ data: { businessId: biz, phoneNumberId: PNID, wabaId: "9990004", status: "CONNECTED", accessTokenEncrypted: encryptSecret("biz-token"), connectedAt: new Date() } });
    const cat = await db.catalog.create({ data: { businessId: biz, name: "Main", status: "ACTIVE" } }); const c = await db.catalogCategory.create({ data: { catalogId: cat.id, name: "Food" } });
    await db.catalogItem.create({ data: { catalogId: cat.id, categoryId: c.id, name: "Classic", nameAr: "كلاسيك", basePriceMinor: 2800, isAvailable: true } });
    await setAiSettings(owner, biz, { enabled: true }, "t");
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect(); });

  it("by area: asks for what is missing, then shows the fee and final total, then places the order with the fee, name and branch", async () => {
    await setRules({ method: "area", areas: rules().areas.map(a => ({ ...a, branch: a.emirate === "Sharjah" ? branchId : a.branch })) } as any);
    let r = await turn(() => say("2 classic delivery please"), id => draft(id));
    expect(lastAi().delivery).toMatchObject({ method: "area", needs: "area", pinReceived: false }); expect(lastAi().customer).toEqual({ name: "Sara Khalid", useName: true }); // trial: the name is used
    expect(r).not.toContain("Reply YES"); expect(r).not.toContain("Delivery fee");
    r = await turn(() => say("Al Majaz St 5, building 2, Sharjah"), id => draft(id, { address: "Al Majaz St 5, building 2", emirate: "Sharjah", area: "Al Majaz" }));
    expect(r).toContain("Subtotal: 56 AED"); expect(r).toContain("Delivery fee: 10 AED"); expect(r).toContain("Total: 66 AED"); expect(r).toContain("For: Sara Khalid"); expect(r).toContain("about 30 minutes"); expect(r).toContain("Reply YES");
    r = await turn(() => say("yes"), id => draft(id, { address: "Al Majaz St 5, building 2", emirate: "Sharjah", area: "Al Majaz", confirmed: true }));
    expect(r).toContain("Total 66 AED");
    const o = await db.order.findFirstOrThrow({ where: { businessId: biz }, include: { deliveryDetails: true } });
    expect(o).toMatchObject({ subtotalMinor: 5600, deliveryFeeMinor: 1000, totalMinor: 6600, locationId: branchId }); expect(o.deliveryDetails).toMatchObject({ recipientName: "Sara Khalid", emirate: "Sharjah", city: "Al Majaz", addressText: "Al Majaz St 5, building 2" });
  });
  it("a shared pin is looked up: the chat shows the place and a map link, and the emirate and area are not asked again", async () => {
    await setRules({ method: "area" });
    const other = "971500000777";
    await turn(() => say("delivery order: 2 classic", other), id => draft(id, { emirate: null, area: "" }));
    const r = await turn(() => inbound({ type: "location", location: { latitude: 25.3402, longitude: 55.3901 } }, other), id => draft(id, { address: "Villa 4", emirate: null, area: "" }));
    const conv = await db.conversation.findFirstOrThrow({ where: { customer: { phone: "+" + other } }, include: { messages: { where: { messageType: "LOCATION" } } } });
    expect(conv.messages[0]!.textContent).toBe("📍 Al Majaz St, Al Majaz, Sharjah\nhttps://maps.google.com/?q=25.3402,55.3901");
    expect(conv.customerLocation).toMatchObject({ emirate: "Sharjah", area: "Al Majaz" });
    expect(lastAi().delivery).toMatchObject({ emirate: "Sharjah", area: "Al Majaz", needs: null });
    expect(r).toContain("Delivery fee: 10 AED");
  });
  it("by distance: a shared location pin sets the fee, is kept on the order, and the customer is told when it is out of range", async () => {
    await setRules({ method: "distance" });
    const other = "971500000555";
    let r = await turn(() => say("delivery order: 2 classic", other), id => draft(id));
    expect(lastAi().delivery).toMatchObject({ method: "distance", needs: "pin", pinReceived: false });
    r = await turn(() => inbound({ type: "location", location: { latitude: 25.3402, longitude: 55.3901, name: "Home", address: "Al Majaz 2" } }, other), id => draft(id, { address: "Al Majaz 2, flat 12" }));
    expect(lastAi().message).toContain("📍"); expect(lastAi().delivery).toMatchObject({ pinReceived: true, needs: null });
    expect(r).toContain("Delivery fee: 5 AED"); expect(r).toContain("Total: 61 AED"); expect(r).toContain("about 35 minutes");
    r = await turn(() => say("yes", other), id => draft(id, { address: "Al Majaz 2, flat 12", confirmed: true }));
    expect(r).toContain("Total 61 AED");
    const o = await db.order.findFirstOrThrow({ where: { businessId: biz, deliveryFeeMinor: 500 }, include: { deliveryDetails: true } });
    expect(o.deliveryDetails).toMatchObject({ latitude: 25.3402, longitude: 55.3901 });
    const far = "971500000666";
    await turn(() => say("delivery order: 2 classic", far), id => draft(id));
    r = await turn(() => inbound({ type: "location", location: { latitude: 25.33, longitude: 55.62 } }, far), id => draft(id, { address: "Far away" }));
    expect(r).toContain("we don't deliver to"); expect(r).not.toContain("Reply YES");
  });
  it("uses the name the customer gives instead of the WhatsApp name, and asks for it when WhatsApp has none", async () => {
    await setRules({ method: "free" });
    const p = "971500000777";
    let r = await turn(() => say("2 classic delivery to Sharjah, Al Nahda", p), id => draft(id, { address: "Al Nahda", emirate: "Sharjah", area: "Al Nahda", customerName: "Fatima" }));
    expect(r).toContain("For: Fatima"); expect(r).toContain("Delivery fee: Free"); expect(r).toContain("Total: 56 AED");
    await db.customer.deleteMany({ where: { businessId: biz, phone: "+971500000888" } });
    r = await turn(() => inbound({ type: "text", textBody: "delivery 2 classic to Sharjah Al Nahda" }, "971500000888", ""), id => draft(id, { address: "Al Nahda", emirate: "Sharjah", area: "Al Nahda" }));
    expect(lastAi().customer.name).toBe(""); expect(r).not.toContain("Reply YES"); // no name anywhere: the assistant has to ask, the summary waits
    r = await turn(() => say("my name is Omar", "971500000888"), id => draft(id, { address: "Al Nahda", emirate: "Sharjah", area: "Al Nahda", customerName: "Omar" }));
    expect(r).toContain("For: Omar"); expect(r).toContain("Reply YES");
  });
  it("still places the order when the assistant forgets the emirate, area, address and name on the confirming turn", async () => {
    await setRules({ method: "area", areas: rules().areas.map(a => ({ ...a, branch: a.emirate === "Sharjah" ? branchId : a.branch })) } as any);
    const p = "971500001111";
    let r = await turn(() => say("2 classic delivery", p), id => draft(id, { address: "Al Majaz St 9", emirate: "Sharjah", area: "Al Majaz" }));
    expect(r).toContain("Total: 66 AED");
    r = await turn(() => say("نعم", p), id => draft(id, { address: "", emirate: null, area: "", customerName: "", addressLabel: "", confirmed: true })); // the model dropped everything it knew
    expect(r).toContain("Total 66 AED");
    expect(await db.order.count({ where: { businessId: biz, totalMinor: 6600, deliveryDetails: { is: { addressText: "Al Majaz St 9" } } } })).toBeGreaterThan(0);
  });
  it("never says the order is placed when the confirmation does not match what was shown: it shows the summary again", async () => {
    const p = "971500002222";
    await turn(() => say("2 classic delivery", p), id => draft(id, { address: "Al Majaz St 9", emirate: "Sharjah", area: "Al Majaz" }));
    const before = await db.order.count({ where: { businessId: biz } });
    const r = await turn(() => say("yes but make it 3", p), id => ({ ...draft(id, { address: "Al Majaz St 9", emirate: "Sharjah", area: "Al Majaz", confirmed: true }), reply: "Done, your order is confirmed! 🎉", order: { items: [{ id: id("Classic"), quantity: 3, notes: "" }], fulfillment: "delivery", address: "Al Majaz St 9", emirate: "Sharjah", area: "Al Majaz", customerName: "", confirmed: true } }));
    expect(await db.order.count({ where: { businessId: biz } })).toBe(before); // changed items: not the summary the customer saw
    expect(r).not.toContain("confirmed!"); expect(r).toContain("reply YES to confirm"); expect(r).toContain("3 × Classic"); expect(r).toContain("Total: 94 AED");
  });
  it("remembers an address under its name and offers it next time, with its pin, without asking again", async () => {
    await setRules({ method: "distance" });
    const p = "971500003333";
    await turn(() => say("2 classic delivery", p), id => draft(id));
    let r = await turn(() => inbound({ type: "location", location: { latitude: 25.3402, longitude: 55.3901 } }, p), id => draft(id, { address: "Opus tower 804", addressLabel: "عمل" }));
    expect(r).toContain("Delivery to (Work): Opus tower 804"); expect(r).toContain("Delivery fee: 5 AED");
    r = await turn(() => say("yes", p), id => draft(id, { address: "Opus tower 804", addressLabel: "Work", confirmed: true }));
    expect(r).toContain("Total 61 AED");
    const rows = await db.customerAddress.findMany({ where: { customer: { businessId: biz, phone: "+" + p } } });
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ label: "Work", addressText: "Opus tower 804", latitude: 25.3402, longitude: 55.3901, isDefault: true });
    expect((await db.order.findFirstOrThrow({ where: { businessId: biz, customer: { phone: "+" + p } }, include: { deliveryDetails: true } })).deliveryDetails).toMatchObject({ addressLabel: "Work" });
    // next order: the saved address is offered and picking it prices the order from its pin, no new pin needed
    r = await turn(() => say("same as last time, delivery to work", p), id => ({ ...draft(id), order: { items: [{ id: id("Classic"), quantity: 2, notes: "" }], fulfillment: "delivery", address: "", emirate: null, area: "", customerName: "", addressLabel: "", savedAddress: "1", confirmed: false } }));
    expect(lastAi().savedAddresses).toEqual([{ id: "1", label: "Work", text: "Opus tower 804, Sharjah" }]);
    expect(r).toContain("Delivery to (Work): Opus tower 804"); expect(r).toContain("Delivery fee: 5 AED"); expect(r).toContain("Reply YES");
    r = await turn(() => say("yes", p), id => ({ ...draft(id), order: { items: [{ id: id("Classic"), quantity: 2, notes: "" }], fulfillment: "delivery", address: "", emirate: null, area: "", customerName: "", addressLabel: "", savedAddress: "1", confirmed: true } }));
    expect(r).toContain("Total 61 AED"); expect(await db.customerAddress.count({ where: { customer: { businessId: biz, phone: "+" + p } } })).toBe(1); // updated, not duplicated
  });
  it("asks for the address name before the order can be confirmed", async () => {
    await setRules({ method: "free" });
    const p = "971500004444";
    let r = await turn(() => say("delivery to Sharjah Al Nahda, 2 classic", p), id => draft(id, { address: "Al Nahda St", emirate: "Sharjah", area: "Al Nahda", addressLabel: "" }));
    expect(r).not.toContain("Reply YES"); // no name for the address yet: the assistant has to ask
    r = await turn(() => say("work", p), id => draft(id, { address: "Al Nahda St", emirate: "Sharjah", area: "Al Nahda", addressLabel: "work" }));
    expect(r).toContain("Delivery to (Work)"); expect(r).toContain("Reply YES");
  });
  it("calls customers by name only on Plus, Pro and the free trial, not on Starter", async () => {
    await setRules({ method: "free" });
    const p = "971500000999";
    await turn(() => say("hi", p), id => draft(id)); expect(lastAi().customer.useName).toBe(true); // trial
    await db.subscription.create({ data: { businessId: biz, plan: "starter", billing: "monthly", status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000), startedAt: new Date() } });
    await turn(() => say("hello again", p), id => draft(id)); expect(lastAi().customer.useName).toBe(false);
    await db.subscription.updateMany({ where: { businessId: biz }, data: { plan: "plus" } });
    await turn(() => say("one more", p), id => draft(id)); expect(lastAi().customer.useName).toBe(true);
  });
  it("keeps the customer informed when the plan's orders are used up, when the AI fails, and when someone floods the chat", async () => {
    const { allowanceFor, usageSummary } = await import("../src/modules/billing/usage");
    const setUsed = async (kind: string, used: number) => { const { period } = await allowanceFor(biz); const w = { businessId: biz, periodStart: period.start, kind }; if (await db.usageCounter.findFirst({ where: w })) await db.usageCounter.updateMany({ where: w, data: { used } }); else await db.usageCounter.create({ data: { ...w, used } }); };
    const limit = (await usageSummary(biz)).orders.limit;
    // Orders used up: a customer with no order in progress gets a plain notice instead of an AI answer (no AI call), not repeated within the hour.
    await setUsed("orders", limit); const a = "971500000901";
    let r = await turn(() => say("hello", a), id => draft(id));
    expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(false); expect(r).toContain("Someone from the restaurant will assist you soon"); expect(r).toContain("سيقوم أحد من المطعم بمساعدتك");
    r = await turn(() => say("hello?", a), id => draft(id)); expect(r).toBe(""); expect(calls.some(c => c.path === "/internal/ai/reply")).toBe(false);
    // The AI itself fails: the customer is told to send it again (never silence) and no allowance is spent.
    await setUsed("orders", 0); await setUsed("ai", 0); ai = { __fail: true }; calls = []; await say("a failing message", "971500000902"); ai = null;
    expect(sent().at(-1)).toContain("Please send your message again"); expect((await usageSummary(biz)).aiReplies.used).toBe(0);
    // A flood: the 11th message in two minutes gets one "slow down", later ones are ignored.
    const f = "971500000903"; let last = "";
    for (let i = 1; i <= 10; i++) last = await turn(() => say(`msg ${i}`, f), id => draft(id)); expect(last).not.toContain("quickly");
    r = await turn(() => say("msg 11", f), id => draft(id)); expect(r).toContain("very quickly");
    r = await turn(() => say("msg 12", f), id => draft(id)); expect(r).toBe("");
    await setUsed("ai", 0);
  });
  it("counts a placed order, finishes an order already started past the limit, and refuses to place one beyond the buffer", async () => {
    const { allowanceFor, usageSummary } = await import("../src/modules/billing/usage");
    const setUsed = async (used: number) => { const { period } = await allowanceFor(biz); await db.usageCounter.updateMany({ where: { businessId: biz, periodStart: period.start, kind: "orders" }, data: { used } }); };
    const before = (await usageSummary(biz)).orders; const who = "971500000904";
    await turn(() => say("delivery order: 2 classic", who), id => draft(id, { address: "Al Majaz 2, flat 3", emirate: "Sharjah", area: "Al Majaz" }));
    let r = await turn(() => say("yes", who), id => draft(id, { address: "Al Majaz 2, flat 3", emirate: "Sharjah", area: "Al Majaz", confirmed: true }));
    expect(r).toContain("received"); expect((await usageSummary(biz)).orders.used).toBe(before.used + 1);
    // Limit reached while a second customer is already mid-order: still allowed (10% buffer)...
    const w2 = "971500000905", w3 = "971500000906";
    await turn(() => say("delivery order: 2 classic", w2), id => draft(id, { address: "Al Majaz 2, flat 4", emirate: "Sharjah", area: "Al Majaz" }));
    await turn(() => say("delivery order: 2 classic", w3), id => draft(id, { address: "Al Majaz 2, flat 5", emirate: "Sharjah", area: "Al Majaz" }));
    await setUsed(before.limit);
    r = await turn(() => say("yes", w2), id => draft(id, { address: "Al Majaz 2, flat 4", emirate: "Sharjah", area: "Al Majaz", confirmed: true }));
    expect(r).toContain("received"); expect((await usageSummary(biz)).orders.used).toBe(before.limit + 1);
    // ...but not past the buffer: the customer is told the restaurant will reply and nothing is placed.
    await setUsed(before.limit + Math.ceil(before.limit * 0.1));
    const orders = await db.order.count({ where: { businessId: biz } });
    r = await turn(() => say("yes", w3), id => draft(id, { address: "Al Majaz 2, flat 5", emirate: "Sharjah", area: "Al Majaz", confirmed: true }));
    expect(r).toContain("Someone from the restaurant will assist you soon"); expect(await db.order.count({ where: { businessId: biz } })).toBe(orders);
    await setUsed(0);
  });
  it("Pro with a menu per branch: no menu until the branch is known (pickup asks, a pin picks the nearest), then that branch's menu, and the order goes to that branch", async () => {
    const { createBranchMenu, addItem } = await import("../src/modules/menu/service");
    // An earlier test may already have given this restaurant a subscription (one per restaurant): switch it to Pro and put it back afterwards.
    const prior = await db.subscription.findFirst({ where: { businessId: biz } });
    const pro = { plan: "pro", billing: "monthly", status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000), startedAt: new Date() };
    const sub = prior ? await db.subscription.update({ where: { id: prior.id }, data: pro }) : await db.subscription.create({ data: { businessId: biz, ...pro } });
    try {
      const second = (await db.location.create({ data: { businessId: biz, name: "Ajman Branch", code: `AJ${suffix}`.toUpperCase(), status: "ACTIVE", latitude: 25.4052, longitude: 55.4451 } })).id;
      await createBranchMenu(owner, biz, second, { copy: false }, "r"); await addItem(owner, biz, { name: "Ajman Special", category: "Grill", price: 35 }, "r", second);
      const reply = (extra: object = {}) => ({ intent: "other", language: "en", reply: "Which branch would you like?", needsHuman: false, order: null, ...extra });
      const who = "971500000911";
      // 1. Pickup, no branch known: the assistant has no menu and is offered the branches; it names the chosen one.
      await turn(() => say("I want to order for pickup", who), () => reply());
      expect(lastAi()).toMatchObject({ branchNeeded: true, menu: [] }); const ajman = lastAi().branches.find((b: any) => b.name === "Ajman Branch").id; expect(lastAi().branches).toHaveLength(2);
      await turn(() => say("the Ajman one", who), () => reply({ reply: "Great, Ajman Branch. What would you like?", branch: ajman }));
      expect((await db.conversation.findFirstOrThrow({ where: { customer: { phone: "+" + who } } })).branchId).toBe(second);
      // 2. Next turn: that branch's own menu (not the shared one), and the order is placed at that branch.
      const pickup = (id: (n: string) => string, confirmed = false) => ({ ...reply({ reply: "Sure", intent: "order_request" }), order: { items: [{ id: id("Ajman Special"), quantity: 1, notes: "" }], fulfillment: "pickup", address: "", emirate: null, area: "", customerName: "", addressLabel: "", savedAddress: "", confirmed } });
      await turn(() => say("one Ajman Special", who), id => pickup(id));
      expect(lastAi().branchNeeded).toBeUndefined(); expect(lastAi().menu.map((m: any) => m.name)).toEqual(["Ajman Special"]);
      const r = await turn(() => say("yes", who), id => pickup(id, true));
      expect(r).toContain("received"); expect((await db.order.findFirstOrThrow({ where: { businessId: biz, locationId: second }, orderBy: { createdAt: "desc" } })).locationId).toBe(second);
      // 3. A location pin picks the nearest branch with no question: near the Sharjah branch the shared menu is used, then a pin near Ajman switches branch and drops the half-made order.
      const w = "971500000912";
      await turn(() => inbound({ type: "location", location: { latitude: 25.3402, longitude: 55.3901 } }, w), () => reply({ reply: "Thanks" }));
      expect(lastAi().branchNeeded).toBeUndefined(); expect(lastAi().menu.map((m: any) => m.name)).toContain("Classic");
      expect((await db.conversation.findFirstOrThrow({ where: { customer: { phone: "+" + w } } })).branchId).toBe(branchId);
      await turn(() => say("2 classic for pickup", w), id => ({ ...pickup(id), order: { ...pickup(id).order, items: [{ id: id("Classic"), quantity: 2, notes: "" }] } }));
      expect((await db.conversation.findFirstOrThrow({ where: { customer: { phone: "+" + w } } })).draftOrder).toBeTruthy();
      await turn(() => inbound({ type: "location", location: { latitude: 25.4052, longitude: 55.4451 } }, w), () => reply({ reply: "Now at Ajman" }));
      const conv = await db.conversation.findFirstOrThrow({ where: { customer: { phone: "+" + w } } });
      expect(conv.branchId).toBe(second); expect(conv.draftOrder).toBeNull(); expect(lastAi().menu.map((m: any) => m.name)).toEqual(["Ajman Special"]);
    } finally { if (prior) await db.subscription.update({ where: { id: prior.id }, data: { plan: prior.plan, billing: prior.billing, status: prior.status, currentPeriodStart: prior.currentPeriodStart, currentPeriodEnd: prior.currentPeriodEnd } }); else await db.subscription.delete({ where: { id: sub.id } }); }
  });
  it("sends the approved review template to the customer when the order is placed (the plain message is only the fallback)", async () => {
    await setRules({ method: "area" }); reviewOn = true; const who = "971500000921";
    try {
      await turn(() => say("delivery order: 2 classic", who), id => draft(id, { address: "Al Majaz 2, flat 8", emirate: "Sharjah", area: "Al Majaz" }));
      const r = await turn(() => say("yes", who), id => draft(id, { address: "Al Majaz 2, flat 8", emirate: "Sharjah", area: "Al Majaz", confirmed: true }));
      const review = calls.find(c => c.path === "/internal/whatsapp/order-review")!.body;
      expect(review).toMatchObject({ to: "+" + who, customerName: "Sara Khalid", restaurantName: "Delivery Burgers", items: "2× Classic", total: "66 AED" }); expect(review.orderNumber).toMatch(/^#\d+$/);
      expect(r).toBe(""); // the template replaced the plain "order received" message
      const stored = await db.message.findFirstOrThrow({ where: { externalMessageId: { startsWith: "wamid.rev." }, conversation: { customer: { phone: "+" + who } } } });
      expect(stored.textContent).toContain("received"); expect(stored.senderType).toBe("AI"); // the inbox still shows what the customer was told
    } finally { reviewOn = false; }
  });
  it("asks for the location with a one-tap Send location button, and sends plain text when WhatsApp refuses the button", async () => {
    await setRules({ method: "distance" });
    const ask = (id: (n: string) => string) => ({ ...draft(id), reply: "Please share your location", askLocation: true });
    await turn(() => say("delivery order: 2 classic", "971500000922"), ask);
    expect(calls.find(c => c.path === "/internal/whatsapp/send")!.body).toMatchObject({ kind: "location_request", text: expect.stringContaining("share your location") });
    rejectKind = true;
    try {
      const r = await turn(() => say("delivery order: 2 classic", "971500000923"), ask);
      const sends = calls.filter(c => c.path === "/internal/whatsapp/send"); expect(sends).toHaveLength(2); expect(sends[0]!.body.kind).toBe("location_request"); expect(sends[1]!.body.kind).toBeUndefined(); expect(r).toContain("share your location");
    } finally { rejectKind = false; }
    // Once a pin is known the button is not offered again.
    await turn(() => inbound({ type: "location", location: { latitude: 25.3402, longitude: 55.3901 } }, "971500000922"), id => ask(id));
    expect(calls.filter(c => c.path === "/internal/whatsapp/send").every(c => !c.body.kind)).toBe(true);
  });
  describe("Pro with a menu per branch: finding the branch without a pin", () => {
    const pro = async () => {
      const prior = await db.subscription.findFirst({ where: { businessId: biz } });
      const fields = { plan: "pro", billing: "monthly", status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000), startedAt: new Date() };
      const sub = prior ? await db.subscription.update({ where: { id: prior.id }, data: fields }) : await db.subscription.create({ data: { businessId: biz, ...fields } });
      const { createBranchMenu, addItem } = await import("../src/modules/menu/service");
      let second = (await db.location.findFirst({ where: { businessId: biz, name: "Ajman Branch" } }))?.id;
      if (!second) { second = (await db.location.create({ data: { businessId: biz, name: "Ajman Branch", code: `AJ2${suffix}`.toUpperCase(), status: "ACTIVE", latitude: 25.4052, longitude: 55.4451 } })).id; await createBranchMenu(owner, biz, second, { copy: false }, "r"); await addItem(owner, biz, { name: "Ajman Special", category: "Grill", price: 35 }, "r", second); }
      return { second, restore: async () => { if (prior) await db.subscription.update({ where: { id: prior.id }, data: { plan: prior.plan, billing: prior.billing, status: prior.status, currentPeriodStart: prior.currentPeriodStart, currentPeriodEnd: prior.currentPeriodEnd } }); else await db.subscription.delete({ where: { id: sub.id } }); } };
    };
    const reply = (extra: object = {}) => ({ intent: "other", language: "en", reply: "Sure", needsHuman: false, order: null, ...extra });
    const conv = (who: string) => db.conversation.findFirstOrThrow({ where: { customer: { phone: "+" + who } } });
    it("uses the restaurant's own area rules: naming the area is enough", async () => {
      const { second, restore } = await pro();
      try {
        await setRules({ method: "area", areas: [{ emirate: "Ajman", area: "Nuaimiya", fee: "20", min: "", eta: "60", branch: second, on: true }, { emirate: "Sharjah", area: "Al Majaz", fee: "10", min: "", eta: "30", branch: branchId, on: true }] });
        const who = "971500000931";
        await turn(() => say("I am in Nuaimiya, Ajman", who), () => reply());
        expect(lastAi().branchNeeded).toBeUndefined(); expect(lastAi().menu.map((m: any) => m.name)).toEqual(["Ajman Special"]); expect((await conv(who)).branchId).toBe(second);
      } finally { await restore(); }
    });
    it("looks up a typed address, asks the customer to confirm the place found, then treats it like a shared pin", async () => {
      const { second, restore } = await pro();
      try {
        await setRules({ method: "distance" }); const who = "971500000932";
        geoFound = { found: true, latitude: 25.4052, longitude: 55.4451, emirate: "Ajman", area: "Nuaimiya", street: "Sheikh Khalifa St", place: "Pearl Tower", formatted: "Pearl Tower, Sheikh Khalifa St, Nuaimiya, Ajman" };
        await turn(() => say("Pearl tower 804 near the corniche", who), () => reply({ reply: "I found Pearl Tower, is that right?" }));
        expect(calls.find(c => c.path === "/internal/geo/search")!.body.query).toContain("Pearl tower 804"); expect(lastAi().candidate).toBe("Pearl Tower, Sheikh Khalifa St, Nuaimiya, Ajman");
        expect((await conv(who)).candidateLocation).toMatchObject({ formatted: "Pearl Tower, Sheikh Khalifa St, Nuaimiya, Ajman" }); expect((await conv(who)).customerLocation).toBeNull(); // nothing is trusted until they confirm
        await turn(() => say("yes", who), () => reply({ reply: "Great", locationConfirmed: true }));
        const c = await conv(who); expect(c.candidateLocation).toBeNull(); expect(c.customerLocation).toMatchObject({ latitude: 25.4052, longitude: 55.4451, emirate: "Ajman", area: "Nuaimiya", source: "address" });
        await turn(() => say("2 specials please", who), () => reply());
        expect(lastAi().branchNeeded).toBeUndefined(); expect(lastAi().menu.map((m: any) => m.name)).toEqual(["Ajman Special"]); expect((await conv(who)).branchId).toBe(second); // the nearest branch to the confirmed place
        // Small talk is never looked up.
        calls = []; await turn(() => say("hello there", "971500000933"), () => reply()); expect(calls.some(c => c.path === "/internal/geo/search")).toBe(false);
      } finally { geoFound = { found: false }; await restore(); }
    });
    it("offers the branches as buttons for pickup and puts the customer's last branch first", async () => {
      const { second, restore } = await pro();
      try {
        await setRules({ method: "distance" }); const who = "971500000934";
        await turn(() => say("hi", who), () => reply({ reply: "Pickup or delivery?" }));
        await db.customer.updateMany({ where: { phone: "+" + who }, data: { lastBranchId: second } });
        await turn(() => say("pickup please", who), () => reply({ reply: "Which branch would you like?" }));
        expect(lastAi()).toMatchObject({ branchNeeded: true, lastBranch: "Ajman Branch" });
        const send = calls.filter(c => c.path === "/internal/whatsapp/send").at(-1)!.body;
        expect(send.kind).toBe("buttons"); expect(send.options.map((o: any) => o.title).sort()).toEqual(["Ajman Branch", expect.any(String)].sort());
        expect(send.options.length).toBeLessThanOrEqual(3);
      } finally { await restore(); }
    });
  });
});
