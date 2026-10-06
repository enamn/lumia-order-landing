import { createElement as h } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountMenu, PlanBadge } from "../src/design/AccountMenu";

const items = [{ key: "settings", icon: "settings", label: "Settings", onPick: () => {} }, { key: "billing", icon: "billing", label: "Billing", onPick: () => {} }, { key: "logout", icon: "logout", label: "Log out", danger: true, onPick: () => {} }];
describe("the restaurant chip and the plan badge", () => {
  it("the chip shows the restaurant name only (no plan), closed until it is clicked", () => {
    const html = renderToStaticMarkup(h(AccountMenu, { variant: "sidebar", name: "Burger House", avatar: "BH", active: false, ar: false, items }));
    expect(html).toContain("Burger House"); expect(html).not.toContain("Plus"); expect(html).toContain('aria-haspopup="menu"'); expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"'); // Settings, Billing and Log out only appear when opened
  });
  it("the phone header shows only the avatar", () => {
    const html = renderToStaticMarkup(h(AccountMenu, { variant: "header", name: "Burger House", avatar: "BH", active: false, ar: true, items }));
    expect(html).toContain('aria-label="Burger House"'); expect(html).toContain('dir="rtl"');
  });
  it("the plan is one small word", () => {
    const html = renderToStaticMarkup(h(PlanBadge, { label: "Pro", kind: "pro", onClick: () => {} }));
    expect(html).toContain(">Pro<"); expect(html).toContain("<button");
  });
});
