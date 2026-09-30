import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "../src/modules/onboarding/readiness";
import { can } from "../src/server/authorization";
import { createBusinessSchema, profileSchema } from "../src/modules/business/validators";
import { SaveQueue } from "../src/lib/save-queue";

describe("launch requirements", () => {
 it("does not infer a live business from UI progress", () => { const result = evaluateReadiness({ profileComplete: true, activeLocation: true, whatsappConnected: false, activeCatalog: false, availableItem: false, activeAgent: false, orderSettings: false }); expect(result.ready).toBe(false); expect(result.missing.map(m => m.code)).toContain("WHATSAPP_NOT_CONNECTED"); expect(result.missing).toHaveLength(5); });
 it("requires every prerequisite, but no device", () => { expect(evaluateReadiness({ profileComplete: true, activeLocation: true, whatsappConnected: true, activeCatalog: true, availableItem: true, activeAgent: true, orderSettings: true })).toEqual({ ready: true, missing: [] }); });
});
describe("roles and input", () => {
 it("separates manager operational access from identity and team changes", () => { expect(can("MANAGER", "operations.manage")).toBe(true); expect(can("MANAGER", "business.manage")).toBe(false); expect(can("MANAGER", "users.manage")).toBe(false); for (const role of ["STAFF", "VIEWER"] as const) { expect(can(role, "read")).toBe(true); expect(can(role, "operations.manage")).toBe(false); } });
 it("only activates restaurant businesses and refuses extra tenant keys", () => { expect(createBusinessSchema.safeParse({ name: "Demo", locationName: "Main", businessType: "SALON" }).success).toBe(false); expect(createBusinessSchema.safeParse({ name: "Demo", locationName: "Main", organizationId: "other" }).success).toBe(false); });
 it("validates phones, complete weekday sets and protected fields", () => { const base = { revision: 0, name: "Demo", nameAr: "", email: "", phone: "+971501234567", vatRegistered: false, taxRegistrationNumber: "", location: { id: crypto.randomUUID(), name: "Main", addressLine1: "Road", city: "Sharjah", emirate: "Sharjah", hours: Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,isClosed:false,openTime:"09:00",closeTime:"22:00"})) } }; expect(profileSchema.safeParse(base).success).toBe(true); expect(profileSchema.safeParse({...base,phone:"0501234567"}).success).toBe(false); expect(profileSchema.safeParse({...base,status:"ACTIVE"}).success).toBe(false); expect(profileSchema.safeParse({...base,location:{...base.location,hours:base.location.hours.map(h=>({...h,dayOfWeek:0}))}}).success).toBe(false); });
});
describe("autosave ordering", () => {
 it("never overlaps writes and coalesces edits made while saving", async () => { const writes: number[] = []; let release!: () => void; const first = new Promise<void>(r=>{release=r}); const queue = new SaveQueue<number>(async value=>{writes.push(value);if(value===1)await first},()=>{}); queue.enqueue(1); queue.enqueue(2); queue.enqueue(3); expect(writes).toEqual([1]); release(); await new Promise(r=>setTimeout(r,0)); expect(writes).toEqual([1,3]); });
 it("pauses on failure, keeps latest edits and retries explicitly", async () => { let fail=true; const values:number[]=[]; const states:string[]=[]; const queue=new SaveQueue<number>(async value=>{if(fail)throw Error("offline");values.push(value)},s=>states.push(s));queue.enqueue(1);await new Promise(r=>setTimeout(r,0));queue.enqueue(2);expect(values).toEqual([]);fail=false;queue.retry();await new Promise(r=>setTimeout(r,0));expect(values).toEqual([2]);expect(states).toEqual(["saving","error","saving","saved"]); });
});
