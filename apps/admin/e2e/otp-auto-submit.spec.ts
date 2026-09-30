import { test, expect } from "@playwright/test";

test("six digits verify automatically; errors allow correction without duplicate requests", async ({ page }) => {
  const submitted: string[] = [];
  await page.route("**/api/auth/whatsapp/send-code", route => route.fulfill({ json: { expiresIn: 300, resendAfter: 60, deliveryLanguage: "en" } }));
  await page.route("**/api/auth/whatsapp/verify-code", async route => {
    const { code } = route.request().postDataJSON();
    submitted.push(code);
    if (code === "123456") await route.fulfill({ status: 400, json: { code: "INVALID_CODE", message: "Incorrect code. Try again." } });
    else await route.fulfill({ json: { redirectTo: "/onboarding?lang=en" } });
  });
  await page.route("**/onboarding?lang=en", route => route.fulfill({ contentType: "text/html", body: "<h1>Tell us about your restaurant</h1>" }));
  await page.goto("/signup");
  await page.getByLabel("Mobile number", { exact: true }).fill("501234567");
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  const input = page.getByLabel("Verification code", { exact: true });
  await input.pressSequentially("12345");
  expect(submitted).toEqual([]);
  await input.pressSequentially("6");
  await expect(page.locator(".entry-error[role=alert]")).toHaveText("Incorrect code. Try again.");
  expect(submitted).toEqual(["123456"]);
  await input.fill("654321");
  await expect(page.getByRole("heading", { name: "Tell us about your restaurant" })).toBeVisible();
  expect(submitted).toEqual(["123456", "654321"]);
});

test("pasted Arabic digits verify automatically", async ({ page }) => {
  const submitted: string[] = [];
  await page.route("**/api/auth/whatsapp/send-code", route => route.fulfill({ json: { expiresIn: 300, resendAfter: 60, deliveryLanguage: "en" } }));
  await page.route("**/api/auth/whatsapp/verify-code", async route => {
    submitted.push(route.request().postDataJSON().code);
    await route.fulfill({ json: { redirectTo: "/onboarding?lang=en" } });
  });
  await page.route("**/onboarding?lang=en", route => route.fulfill({ contentType: "text/html", body: "<h1>Tell us about your restaurant</h1>" }));
  await page.goto("/signup");
  await page.getByLabel("Mobile number", { exact: true }).fill("501234567");
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await page.getByLabel("Verification code", { exact: true }).evaluate(input => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text", "٦٥٤ ٣٢١");
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole("heading", { name: "Tell us about your restaurant" })).toBeVisible();
  expect(submitted).toEqual(["654321"]);
});
