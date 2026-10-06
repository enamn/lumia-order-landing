import { createElement as h } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountMenu } from "../src/design/AccountMenu";

const items = [{ key: "settings", icon: "settings", label: "Settings", onPick: () => {} }, { key: "billing", icon: "billing", label: "Billing", onPick: () => {} }, { key: "logout", icon: "logout", label: "Log out", danger: true, onPick: () => {} }];
describe("the restaurant chip", () => {
  it("shows the restaurant and its plan as a badge, closed until it is clicked", () => {
    const html = renderToStaticMarkup(h(AccountMenu, { variant: "sidebar", name: "Burger House", avatar: "BH", badge: "Plus", badgeKind: "plus", active: false, ar: false, items }));
    expect(html).toContain("Burger House"); expect(html).toContain("Plus"); expect(html).toContain('aria-haspopup="menu"'); expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"'); // Settings, Billing and Log out only appear when opened
  });
  it("the phone header shows only the avatar; no badge when there is no plan", () => {
    const html = renderToStaticMarkup(h(AccountMenu, { variant: "header", name: "Burger House", avatar: "BH", badge: null, badgeKind: "plus", active: false, ar: true, items }));
    expect(html).toContain('aria-label="Burger House"'); expect(html).toContain('dir="rtl"'); expect(html).not.toContain("Plus");
  });
});
