import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "../src/server/db";
import { createBusiness, getBusiness, updateBusiness, updateLocation, completeOnboarding, setMember } from "../src/modules/business/service";
import { toProfile } from "../src/modules/business/presenter";
const enabled = process.env.RUN_DB_TESTS === "true";
// The suite creates uniquely named fixtures and never deletes unrelated data.
describe.skipIf(!enabled)("MongoDB tenant boundary", () => {
 let alice:string, bob:string, manager:string, viewer:string, a:string, b:string;
 const suffix=crypto.randomUUID();
 beforeAll(async()=>{
   const users=await Promise.all(["alice","bob","manager","viewer"].map(name=>db.user.create({data:{name,email:`${name}-${suffix}@test.invalid`,phoneNumber:`+971${Date.now().toString().slice(-8)}${name.length}`,phoneNumberVerified:true}})));
   [alice,bob,manager,viewer]=users.map(u=>u.id);
   const [aa,bb]=await Promise.all([createBusiness(alice,{name:"Alpha",locationName:"Alpha branch"},"test"),createBusiness(bob,{name:"Beta",locationName:"Beta branch"},"test")]);a=aa.id;b=bb.id;
   await db.membership.createMany({data:[{organizationId:aa.organizationId,userId:manager,role:"MANAGER"},{organizationId:aa.organizationId,userId:viewer,role:"VIEWER"}]});
 });
 afterAll(async()=>{await db.$disconnect()});
 it("rejects cross-tenant reads",async()=>{await expect(getBusiness(alice,b)).rejects.toMatchObject({status:404});await expect(getBusiness(bob,a)).rejects.toMatchObject({status:404});});
 it("reuses initial workspace on concurrent retries",async()=>{const results=await Promise.all([createBusiness(alice,{name:"Changed",locationName:"Main"},"test"),createBusiness(alice,{name:"Changed",locationName:"Main"},"test")]);expect(results.map(r=>r.id)).toEqual([a,a]);expect(await db.business.count({where:{organization:{members:{some:{userId:alice}}}}})).toBe(1);});
 it("rejects another tenant's nested location without modifying either business",async()=>{const aa=toProfile(await getBusiness(alice,a));const bb=toProfile(await getBusiness(bob,b));await expect(updateBusiness(alice,a,{...aa,location:bb.location},"test")).rejects.toMatchObject({status:404});await expect(updateLocation(alice,a,bb.location.id,{revision:aa.revision,location:bb.location},"test")).rejects.toMatchObject({status:404});expect((await getBusiness(alice,a)).revision).toBe(aa.revision);});
 it("saves atomically, records audit and resumes persisted onboarding",async()=>{const profile=toProfile(await getBusiness(alice,a));const result=await updateBusiness(alice,a,{...profile,phone:"+971501111111",location:{...profile.location,addressLine1:"Al Majaz",city:"Sharjah"}},"test-save");expect(result.revision).toBe(profile.revision+1);expect(result.onboarding?.steps.find(s=>s.stepKey==="BUSINESS")?.status).toBe("COMPLETED");expect(await db.auditLog.count({where:{businessId:a,requestId:"test-save"}})).toBe(1);await expect(updateBusiness(alice,a,profile,"stale")).rejects.toMatchObject({status:409,code:"STALE_REVISION"});});
 it("allows one winner for concurrent versioned writes",async()=>{const profile=toProfile(await getBusiness(alice,a));const results=await Promise.allSettled([updateBusiness(alice,a,{...profile,name:"Alpha one"},"test"),updateBusiness(alice,a,{...profile,name:"Alpha two"},"test")]);expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);});
 it("enforces manager and viewer restrictions on the server",async()=>{const profile=toProfile(await getBusiness(manager,a));await expect(updateBusiness(manager,a,profile,"test")).rejects.toMatchObject({status:403});await expect(updateBusiness(viewer,a,profile,"test")).rejects.toMatchObject({status:403});await expect(updateLocation(viewer,a,profile.location.id,{revision:profile.revision,location:profile.location},"test")).rejects.toMatchObject({status:403});await expect(updateLocation(manager,a,profile.location.id,{revision:profile.revision,location:{...profile.location,name:"Managed branch"}},"test")).resolves.toMatchObject({id:a});});
 it("never lets the frontend force Go Live",async()=>{await expect(completeOnboarding(alice,a)).rejects.toMatchObject({code:"GO_LIVE_BLOCKED",status:409});expect((await getBusiness(alice,a)).status).toBe("DRAFT");});
 it("protects owner role and requires team permission",async()=>{const owner=await db.user.findUniqueOrThrow({where:{id:alice}});await expect(setMember(alice,a,{phoneNumber:owner.phoneNumber,role:"VIEWER"},"test")).rejects.toMatchObject({status:403});await expect(setMember(manager,a,{phoneNumber:owner.phoneNumber,role:"STAFF"},"test")).rejects.toMatchObject({status:403});});
 it("rejects suspended memberships",async()=>{await db.membership.updateMany({where:{userId:viewer},data:{status:"SUSPENDED"}});await expect(getBusiness(viewer,a)).rejects.toMatchObject({status:404});});
});
