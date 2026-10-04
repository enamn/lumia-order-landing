import { z } from "zod";

export const EMIRATES = ["Sharjah", "Ajman", "Dubai", "Abu Dhabi", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"] as const;
export const SECTIONS = ["profile", "branches", "wa", "delivery", "hours", "pay"] as const;
export type Section = (typeof SECTIONS)[number];

const text = (max: number) => z.string().trim().max(max);
const digits = (max: number) => z.string().trim().regex(new RegExp(`^\\d{0,${max}}$`), "Use numbers only.");
const money = z.string().trim().regex(/^\d{0,6}(\.\d{1,2})?$/, "Use a number, e.g. 30 or 12.5.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.");
const phone = z.string().trim().transform(v => v.replace(/[\s()-]/g, "")).pipe(z.union([z.literal(""), z.string().regex(/^\+[1-9]\d{6,14}$/, "Use international format, e.g. +971 50 123 4567")]));
const id = z.string().min(1).max(64);

export const profileSection = z.object({
  name: text(120).min(2, "Enter the legal name."), brand: text(120).min(2, "Enter the restaurant name."), cuisine: text(60), phone, support: phone,
  email: z.union([z.literal(""), z.email()]), vat: z.boolean(), trn: z.string().trim().max(30),
  lang: z.enum(["ar", "en", "both"]), greet: z.enum(["friendly", "formal", "short"]),
  logo: z.string().max(200000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Logo must be a PNG or JPG image.").nullable(),
}).strict().refine(v => !v.vat || v.trn.replace(/\D/g, "").length === 15, { path: ["trn"], message: "The tax registration number must be 15 digits." });

export const branchSection = z.array(z.object({
  id, name: text(120).min(2, "Every branch needs a name."), emirate: z.enum(EMIRATES), area: text(100), address: text(240), phone, eta: digits(3),
  active: z.boolean(), pin: z.boolean(), coords: z.string().trim().max(60),
}).strict()).min(1, "Keep at least one branch.").max(30);

export const waSection = z.object({ routing: z.enum(["one", "all", "selected"]), one: z.string().max(64), sel: z.array(id).max(30) }).strict();

const area = z.object({ emirate: z.enum(EMIRATES), area: text(100), fee: money, min: money, eta: digits(3), branch: z.string().max(64), on: z.boolean() }).strict();
const range = z.object({ from: money, to: money, fee: money, min: money, eta: digits(3), on: z.boolean() }).strict();
export const deliverySection = z.object({
  status: z.enum(["available", "pickup", "paused"]), method: z.enum(["area", "distance", "free", "manual"]).nullable(),
  minOrder: money, freeAbove: money, eta: digits(3), pinReq: z.boolean(), areas: z.array(area).max(60), ranges: z.array(range).max(20),
  freeEm: z.array(z.enum(EMIRATES)).max(7), freeAreas: text(200), freeBranch: z.string().max(64), manualMsg: text(300), confirmFirst: z.boolean(),
}).strict().superRefine((v, ctx) => {
  if (v.method !== "distance") return;
  const on = v.ranges.filter(r => r.on), hi = (r: { to: string }) => r.to === "" ? Infinity : +r.to;
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) if (+on[i].from < hi(on[j]) && +on[j].from < hi(on[i])) ctx.addIssue({ code: "custom", path: ["ranges"], message: "Distance ranges cannot overlap." });
});

const day = z.object({ day: text(12), open: z.boolean(), from: time, to: time, last: time, brk: z.boolean(), bFrom: time, bTo: time }).strict();
const week = z.array(day).length(7);
export const hoursSection = z.object({
  mode: z.enum(["every", "custom", "closed"]), scope: z.enum(["same", "per"]), sel: z.string().max(64), every: day, closedUntil: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  same: week, per: z.record(z.string().max(64), week),
}).strict();

export const paySection = z.object({ cod: z.boolean(), verify: z.boolean(), threshold: digits(6) }).strict();

export const sectionSchemas = { profile: profileSection, branches: branchSection, wa: waSection, delivery: deliverySection, hours: hoursSection, pay: paySection } as const;

export type Profile = z.infer<typeof profileSection>;
export type Branch = z.infer<typeof branchSection>[number];
export type Delivery = z.infer<typeof deliverySection>;
export type Hours = z.infer<typeof hoursSection>;
