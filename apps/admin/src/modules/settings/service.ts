import { Prisma } from "@prisma/client";
import { decimalsOf, fromMinor, toMinor } from "../market/money";
import { isCountryCode, marketOf, type CountryCode } from "../market/countries";
import { isRegionOf, regionNames } from "../market/regions";
import { taxDecisionFor } from "../tax/service";
import { db } from "@/server/db";
import { transaction } from "@/server/transaction";
import { authorize, can } from "@/server/authorization";
import { AppError } from "@/server/errors";
import { updateProgress } from "../business/service";
import { entitlements, entitlementsFor, getSubscriptionFor } from "../billing/service";
import { SHARED } from "../menu/catalog";
import { EXTRA_BRANCH, quoteExtraBranch, type Billing } from "../billing/plans";
import { SECTIONS, sectionSchemas, EMIRATES, type Section, type Profile, type Branch, type Delivery, type Hours } from "./schema";

// The restaurant settings. Profile basics, branches, hours and ordering rules live in the tables the rest of the app already reads
// (Business, Location, BusinessHours, OrderSettings); the extras the design adds (greeting style, WhatsApp routing, delivery pricing,
// payments) are kept in Business.settings.
type Stored = Partial<{ profile: Pick<Profile, "name" | "cuisine" | "support" | "lang" | "greet">; branchEta: Record<string, string>; wa: unknown; delivery: Delivery; hours: Hours; pay: unknown }>;
const stored = (v: Prisma.JsonValue | null | undefined): Stored => (v && typeof v === "object" && !Array.isArray(v) ? v as Stored : {});

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dow = (i: number) => (i + 1) % 7; // the design starts on Monday; BusinessHours stores 0 = Sunday
const dayRow = (day: string, from = "12:00", to = "23:30", open = true) => ({ day, open, from, to, last: to, brk: false, bFrom: "16:00", bTo: "17:00" });
const num = (v: string) => (v === "" ? 0 : Number(v));
const digitsOnly = (v: string) => v.replace(/\D/g, "");
const coordsOf = (l: { latitude: number | null; longitude: number | null }) => (l.latitude !== null && l.longitude !== null ? `${l.latitude}, ${l.longitude}` : "");
const parseCoords = (v: string): { latitude: number; longitude: number } | null => {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(v);
  if (!m) return null; const latitude = +m[1], longitude = +m[2];
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
};

type Loaded = Awaited<ReturnType<typeof load>>;
async function load(businessId: string, client: Prisma.TransactionClient | typeof db = db) {
  return client.business.findUniqueOrThrow({ where: { id: businessId }, include: { locations: { orderBy: { createdAt: "asc" }, include: { hours: { orderBy: { dayOfWeek: "asc" } } } }, orderSettings: true } });
}

const cc = (code: string): CountryCode => (isCountryCode(code) ? code : "AE");
function branchesOf(b: Loaded, s: Stored): Branch[] {
  return b.locations.map(l => ({ id: l.id, name: l.name, emirate: isRegionOf(cc(b.countryCode), l.emirate) ? l.emirate : regionNames(cc(b.countryCode))[0]!, area: l.city, address: l.addressLine1, phone: l.phone ?? "", eta: s.branchEta?.[l.id] ?? "45", active: l.status === "ACTIVE", pin: l.latitude !== null && l.longitude !== null, coords: coordsOf(l) }));
}
function weekOf(l: Loaded["locations"][number] | undefined) {
  return DAYS.map((d, i) => { const h = l?.hours.find(x => x.dayOfWeek === dow(i)); return h ? dayRow(d, h.openTime, h.closeTime, !h.isClosed) : dayRow(d); });
}
function sectionsOf(b: Loaded) {
  const s = stored(b.settings), branches = branchesOf(b, s), first = b.locations[0];
  const os = b.orderSettings;
  const profile: Profile = { name: s.profile?.name || b.name, brand: b.name, cuisine: s.profile?.cuisine ?? "", phone: b.phone ?? "", support: s.profile?.support ?? "", email: b.email ?? "", vat: b.vatRegistered, trn: b.taxRegistrationNumber ?? "", lang: s.profile?.lang ?? "both", greet: s.profile?.greet ?? "friendly", logo: b.logoUrl };
  const delivery: Delivery = s.delivery ?? { status: os && !os.supportsDelivery ? "pickup" : "available", method: null, minOrder: os ? String(fromMinor(os.minimumOrderAmountMinor, b.currencyCode)) : "0", freeAbove: "", eta: "45", pinReq: true, areas: [], ranges: [], freeEm: [], freeAreas: "All areas", freeBranch: first?.id ?? "", manualMsg: "Delivery fee will be confirmed by the restaurant after checking your location.", confirmFirst: true };
  const week = weekOf(first);
  const hours: Hours = s.hours ?? { mode: "custom", scope: "same", sel: first?.id ?? "", every: { ...week[0], day: "Every day" }, closedUntil: "", same: week, per: {} };
  const per = { ...hours.per }; for (const l of b.locations) if (!per[l.id]) per[l.id] = hours.same.map(x => ({ ...x }));
  return { profile, branches, wa: (s.wa as object | undefined) ?? { routing: "all", one: first?.id ?? "", sel: b.locations.map(l => l.id) }, delivery, hours: { ...hours, per }, pay: (s.pay as object | undefined) ?? { cod: true, verify: false, threshold: "150" } };
}

// Pro owners can add a branch beyond the included ones for a monthly fee: the settings screen offers it with the price (null when not possible).
async function branchOffer(businessId: string) {
  const sub = await getSubscriptionFor(businessId), e = entitlements(sub);
  if (!e.canBuyBranches || !sub || (sub.extraBranches ?? 0) >= EXTRA_BRANCH.max) return null;
  const tax = await taxDecisionFor(businessId), month = sub.billing === "yearly" ? "year" : "month", q = quoteExtraBranch(sub.billing as Billing, sub.currentPeriodStart, sub.currentPeriodEnd, new Date(), tax.ratePercent);
  const price = EXTRA_BRANCH[sub.billing as Billing];
  return { ratePercent: tax.ratePercent, priceAed: price, period: month, payNowMinor: q.totalMinor, card: (sub.card as { last4?: string } | null)?.last4 ?? null, hasCard: Boolean(sub.stripeCustomerId && sub.stripePaymentMethodId) };
}

export async function getSettings(userId: string, businessId: string) {
  const { member } = await authorize(userId, businessId);
  const b = await load(businessId);
  const catalog = await db.catalog.findFirst({ where: { businessId, status: { not: "ARCHIVED" }, ...SHARED }, orderBy: { createdAt: "asc" } });
  const items = catalog ? await db.catalogItem.findMany({ where: { catalogId: catalog.id, status: { not: "ARCHIVED" } }, select: { basePriceMinor: true, isAvailable: true, updatedAt: true, categoryId: true } }) : [];
  const wa = await db.whatsAppAccount.findFirst({ where: { businessId, status: "CONNECTED" }, select: { displayPhoneNumber: true } });
  return {
    sections: sectionsOf(b), canEdit: can(member.role, "business.manage"),
    business: { id: b.id, name: b.name, logoUrl: b.logoUrl },
    menu: { categories: new Set(items.map(i => i.categoryId).filter(Boolean)).size, items: items.length, missingPrices: items.filter(i => i.basePriceMinor <= 0).length, soldOut: items.filter(i => !i.isAvailable).length, updatedAt: items.reduce<Date | null>((m, i) => (!m || i.updatedAt > m ? i.updatedAt : m), null) },
    whatsapp: { connected: Boolean(wa), displayPhoneNumber: wa?.displayPhoneNumber ?? "" },
    emailVerified: !!b.email && !!b.emailVerifiedAt, currency: b.currencyCode, country: b.countryCode,
    branchLimit: (await entitlementsFor(businessId)).branches,
    branchBuy: await branchOffer(businessId),
  };
}

export async function saveSettingsSection(userId: string, businessId: string, section: string, input: unknown, requestId: string) {
  if (!(SECTIONS as readonly string[]).includes(section)) throw new AppError("NOT_FOUND", "Settings page not found.", 404);
  const key = section as Section;
  const parsed = sectionSchemas[key].safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Check the highlighted fields.", 400);
  const data = parsed.data as never;
  await transaction(async tx => {
    const { business } = await authorize(userId, businessId, "business.manage", tx);
    const current = stored((await tx.business.findUniqueOrThrow({ where: { id: businessId }, select: { settings: true } })).settings);
    const next: Stored = { ...current };
    if (key === "profile") {
      const p = data as Profile;
      next.profile = { name: p.name, cuisine: p.cuisine, support: p.support, lang: p.lang, greet: p.greet };
      const before = await tx.business.findUnique({ where: { id: businessId }, select: { email: true } });
      await tx.business.update({ where: { id: businessId }, data: { name: p.brand, phone: p.phone || null, email: p.email || null, ...((before?.email ?? "").toLowerCase() !== (p.email ?? "").trim().toLowerCase() ? { emailVerifiedAt: null } : {}), logoUrl: p.logo, vatRegistered: p.vat, taxRegistrationNumber: p.vat ? digitsOnly(p.trn) : null, settings: next as Prisma.InputJsonValue, revision: { increment: 1 } } });
      await updateProgress(tx, businessId);
    } else if (key === "branches") {
      const list = data as Branch[], eta: Record<string, string> = {};
      // Every branch is in the restaurant's own country: its region must be one of that country's regions (also when the request skips the form).
      const country = cc((await tx.business.findUniqueOrThrow({ where: { id: businessId }, select: { countryCode: true } })).countryCode);
      if (list.some(x => !isRegionOf(country, x.emirate))) throw new AppError("BRANCH_OUTSIDE_RESTAURANT_COUNTRY", `A branch must be in ${marketOf(country).nameEn}. Choose a ${marketOf(country).regionLabelEn.toLowerCase()} from the list.`, 422);
      const existing = await tx.location.findMany({ where: { businessId }, include: { hours: true }, orderBy: { createdAt: "asc" } });
      const template = existing[0]?.hours ?? [];
      const e = await entitlementsFor(businessId), limit = e.branches;
      // Switched-off branches do not count: only active ones are limited by the plan.
      const activeAfter = list.filter(b => b.active).length, activeBefore = existing.filter(l => l.status === "ACTIVE").length;
      if (activeAfter > limit && activeAfter > activeBefore) throw new AppError("PLAN_LIMIT", e.canBuyBranches ? `Your plan includes ${limit} active ${limit === 1 ? "branch" : "branches"}. Add an extra branch for AED 99 a month to add another.` : `Your plan includes ${limit} ${limit === 1 ? "branch" : "branches"}. ${e.plan === "plus" ? "Upgrade to Pro to run more branches." : "Upgrade to run more branches."}`, 403);
      for (const br of list) {
        const coords = br.pin ? parseCoords(br.coords) : null;
        if (br.pin && !coords) throw new AppError("VALIDATION_FAILED", `The location pin for ${br.name} is not valid. Use latitude, longitude.`, 400);
        const fields = { name: br.name, emirate: br.emirate, city: br.area, addressLine1: br.address, phone: br.phone || null, status: br.active ? "ACTIVE" : "INACTIVE", latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null };
        const found = existing.find(l => l.id === br.id);
        if (found) { await tx.location.update({ where: { id: found.id }, data: fields }); eta[found.id] = br.eta || "45"; }
        else {
          const created = await tx.location.create({ data: { ...fields, businessId, code: `B${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase(), hours: { create: Array.from({ length: 7 }, (_, d) => { const t = template.find(x => x.dayOfWeek === d); return { dayOfWeek: d, isClosed: t?.isClosed ?? false, openTime: t?.openTime ?? "09:00", closeTime: t?.closeTime ?? "22:00" }; }) } } });
          eta[created.id] = br.eta || "45";
        }
      }
      next.branchEta = eta;
      await tx.business.update({ where: { id: businessId }, data: { settings: next as Prisma.InputJsonValue, revision: { increment: 1 } } });
      await updateProgress(tx, businessId);
    } else {
      (next as Record<string, unknown>)[key] = data;
      await tx.business.update({ where: { id: businessId }, data: { settings: next as Prisma.InputJsonValue } });
      if (key === "delivery") {
        // Fees and minimums are typed in the restaurant's currency: no more decimals than that currency has (2 for AED/SAR/QAR, 3 for OMR/BHD/KWD).
        const biz = await tx.business.findUniqueOrThrow({ where: { id: businessId }, select: { currencyCode: true, countryCode: true } });
        const money = (v: unknown) => (typeof v === "string" ? v : ""), dec = decimalsOf(biz.currencyCode);
        const dd = data as Delivery, typed = [dd.minOrder, dd.freeAbove, ...dd.areas.flatMap(a => [a.fee, a.min]), ...dd.ranges.flatMap(r => [r.fee, r.min])].map(money);
        if (dd.areas.some(a => !isRegionOf(cc(biz.countryCode), a.emirate)) || dd.freeEm.some(v => !isRegionOf(cc(biz.countryCode), v))) throw new AppError("INVALID_REGION", `Choose regions of ${marketOf(cc(biz.countryCode)).nameEn} only.`, 422);
        if (typed.some(v => (v.split(".")[1]?.length ?? 0) > dec)) throw new AppError("INVALID_AMOUNT", `Use at most ${dec} decimal places for amounts in this currency.`, 422);
        const cur = (await tx.business.findUniqueOrThrow({ where: { id: businessId }, select: { currencyCode: true } })).currencyCode, d = data as Delivery, fields = { supportsDelivery: d.status === "available", supportsPickup: true, minimumOrderAmountMinor: toMinor(num(d.minOrder), cur) };
        await tx.orderSettings.upsert({ where: { businessId }, update: fields, create: { businessId, ...fields, configuredAt: new Date() } });
      }
      if (key === "hours") {
        const h = data as Hours, locations = await tx.location.findMany({ where: { businessId } });
        if (h.mode !== "closed") for (const l of locations) {
          const week = h.mode === "every" ? DAYS.map(d => ({ ...h.every, day: d })) : h.scope === "per" && h.per[l.id] ? h.per[l.id] : h.same;
          await tx.businessHours.deleteMany({ where: { locationId: l.id } });
          await tx.businessHours.createMany({ data: week.map((r, i) => ({ locationId: l.id, dayOfWeek: dow(i), isClosed: !r.open, openTime: r.from, closeTime: r.to })) });
        }
        await updateProgress(tx, businessId);
      }
    }
    await tx.auditLog.create({ data: { organizationId: business.organizationId, businessId, userId, entityType: "Settings", entityId: businessId, action: `settings.${key}.updated`, requestId, afterData: { section: key } } });
  });
  return { section: key, value: sectionsOf(await load(businessId))[key] };
}
