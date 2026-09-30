import { test, expect } from "@playwright/test";
import { requestCode } from "../src/modules/auth/otp";
import { db } from "../src/server/db";
// Only the external WhatsApp delivery is stubbed. Verification, cookies, and
// onboarding use the running app and a real local MongoDB replica set.
test.skip(process.env.E2E_LOCAL_DB !== "true", "Set E2E_LOCAL_DB=true with a local MongoDB preview running.");
test("WhatsApp signup goes directly to restaurant name, persists login and resumes",async({page})=>{
 const national=`50${String(Date.now()).slice(-7)}`;let code="";
 await page.route("**/api/auth/whatsapp/send-code",async route=>{
  const body=route.request().postDataJSON();const realFetch=globalThis.fetch;
  process.env.META_ACCESS_TOKEN="e2e-test-token";process.env.META_AUTH_TEMPLATE_NAME="lumia_verification_en";process.env.META_AUTH_TEMPLATE_LANGUAGE="en_US";
  try { globalThis.fetch=async(_url,options)=>{code=JSON.parse(String(options?.body)).template.components[0].parameters[0].text;return Response.json({messages:[{id:"e2e-provider"}]});};const result=await requestCode(body.phoneNumber,body.language);await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(result)}); }
  finally{globalThis.fetch=realFetch;}
 });
 await page.goto("/dashboard");await expect(page).toHaveURL(/login/);
 await page.getByLabel("Mobile number",{exact:true}).fill(national);await page.getByRole("button",{name:"Send verification code",exact:true}).click();await expect(page.getByRole("heading",{name:"Check your WhatsApp"})).toBeVisible();await expect(page.getByRole("button",{name:/Resend code in/})).toBeDisabled();
 await page.getByLabel("Verification code",{exact:true}).fill(code);await expect(page.getByRole("heading",{name:"Tell us about your restaurant"})).toBeVisible();await expect(page.getByText("Number verified",{exact:true})).toHaveCount(0);
 const cookies=await page.context().cookies();expect(cookies.some(c=>c.name.includes("session_token")&&c.httpOnly&&c.expires>Date.now()/1000)).toBe(true);await page.reload();await expect(page.getByLabel("Restaurant name",{exact:true})).toBeVisible();
 await page.getByLabel("Restaurant name",{exact:true}).fill("Test Kitchen");await page.getByRole("button",{name:"Continue",exact:true}).click();await expect(page).toHaveURL(/onboarding\/business/);
 await page.getByLabel("Street address").fill("Al Majaz 2");await page.getByLabel("City",{exact:true}).fill("Sharjah");await page.getByLabel("Emirate",{exact:true}).fill("Sharjah");await expect(page.getByRole("status")).toHaveText("Saved");await page.reload();await expect(page.getByLabel("Street address")).toHaveValue("Al Majaz 2");
 await page.getByRole("link",{name:"Back to setup"}).click();await expect(page.getByRole("button",{name:"Go live"})).toBeDisabled();
 await page.getByRole("link",{name:"Overview",exact:true}).click();await expect(page.getByRole("heading",{name:/Hello,/})).toBeVisible();await page.screenshot({path:"test-results/dashboard-desktop.png",fullPage:true});
 await page.getByRole("button",{name:"Sign out"}).click();await expect(page).toHaveURL(/login/);await page.goto("/dashboard");await expect(page).toHaveURL(/login/);
 await page.getByRole("button",{name:"العربية",exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.locator("main")).toHaveAttribute("dir","rtl");await page.screenshot({path:"test-results/signup-arabic-mobile.png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await db.$disconnect();
});
