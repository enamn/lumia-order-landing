import { afterEach, describe, expect, it } from "vitest";
import { originAllowed } from "../src/server/origin";

describe("which browser origins may change data", () => {
  const env = process.env as Record<string, string | undefined>; const saved = { APP_URL: env.APP_URL, NODE_ENV: env.NODE_ENV };
  afterEach(() => { env.APP_URL = saved.APP_URL; env.NODE_ENV = saved.NODE_ENV; });
  it("in production only the app's own address counts", () => {
    env.NODE_ENV = "production"; env.APP_URL = "https://app.order.lumia.ae";
    expect(originAllowed("https://app.order.lumia.ae")).toBe(true);
    for (const o of ["http://localhost:3000", "https://evil.example", "https://app.order.lumia.ae.evil.example", "http://app.order.lumia.ae", null, ""]) expect(originAllowed(o)).toBe(false);
  });
  it("in development localhost works whatever APP_URL says (it may be https), other sites still do not", () => {
    env.NODE_ENV = "development"; env.APP_URL = "https://localhost:3000";
    for (const o of ["https://localhost:3000", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"]) expect(originAllowed(o)).toBe(true);
    for (const o of ["https://evil.example", "http://localhost.evil.example", "not a url", null]) expect(originAllowed(o)).toBe(false);
  });
});
