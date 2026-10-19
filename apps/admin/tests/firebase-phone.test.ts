import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const verifyIdToken = vi.fn();
vi.mock("firebase-admin/app", () => ({ getApps: () => [], initializeApp: () => ({ name: "lumia-phone" }) }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken }) }));
import { verifiedFirebasePhone } from "../src/server/firebase-admin";
import { smsFailure } from "../src/design/firebase-phone";
// Google's signature check is mocked; these tests cover the checks Lumia adds on top of it.
const decoded = (over: Record<string, unknown> = {}) => ({ aud: "demo-lumia", auth_time: Math.floor(Date.now() / 1000), phone_number: "+971501234567", firebase: { sign_in_provider: "phone" }, ...over });
describe("Firebase SMS sign-in token", () => {
  beforeEach(() => { process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-lumia"; verifyIdToken.mockReset(); });
  afterEach(() => { delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; });
  it("returns the verified phone number", async () => { verifyIdToken.mockResolvedValue(decoded()); expect(await verifiedFirebasePhone("t".repeat(30))).toBe("+971501234567"); });
  it("rejects a token Firebase refuses", async () => { verifyIdToken.mockRejectedValue(new Error("bad")); await expect(verifiedFirebasePhone("t".repeat(30))).rejects.toMatchObject({ code: "INVALID_CODE" }); });
  it("rejects a token that is not from phone sign-in", async () => { verifyIdToken.mockResolvedValue(decoded({ firebase: { sign_in_provider: "password" } })); await expect(verifiedFirebasePhone("t".repeat(30))).rejects.toMatchObject({ code: "INVALID_CODE" }); });
  it("rejects a token without a phone number", async () => { verifyIdToken.mockResolvedValue(decoded({ phone_number: undefined })); await expect(verifiedFirebasePhone("t".repeat(30))).rejects.toMatchObject({ code: "INVALID_CODE" }); });
  it("rejects a token for another project", async () => { verifyIdToken.mockResolvedValue(decoded({ aud: "other" })); await expect(verifiedFirebasePhone("t".repeat(30))).rejects.toMatchObject({ code: "INVALID_CODE" }); });
  it("rejects an old sign-in", async () => { verifyIdToken.mockResolvedValue(decoded({ auth_time: Math.floor(Date.now() / 1000) - 1200 })); await expect(verifiedFirebasePhone("t".repeat(30))).rejects.toMatchObject({ code: "CODE_EXPIRED" }); });
  it("says SMS is unavailable when Firebase is not set up", async () => { delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; await expect(verifiedFirebasePhone("t".repeat(30))).rejects.toMatchObject({ code: "SMS_NOT_AVAILABLE" }); });
});
describe("Firebase SMS errors", () => {
  it("maps Firebase error codes to the screen's messages", () => {
    expect(smsFailure({ code: "auth/invalid-verification-code" })).toBe("incorrect");
    expect(smsFailure({ code: "auth/code-expired" })).toBe("expired");
    expect(smsFailure({ code: "auth/invalid-phone-number" })).toBe("invalid-number");
    expect(smsFailure({ code: "auth/too-many-requests" })).toBe("too-many");
    expect(smsFailure({ code: "auth/operation-not-allowed" })).toBe("not-available");
    expect(smsFailure(new Error("x"))).toBe("failed");
  });
});
