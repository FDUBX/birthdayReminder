import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "../src/auth/session";

const SECRET = "test-secret";

describe("session", () => {
  it("round-trips userId 42", async () => {
    const token = await signSession({ userId: 42 }, SECRET);
    const payload = await verifySession(token, SECRET);
    expect(payload).toEqual({ userId: 42 });
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ userId: 42 }, SECRET);
    const payload = await verifySession(token + "x", SECRET);
    expect(payload).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession({ userId: 42 }, "other-secret");
    const payload = await verifySession(token, SECRET);
    expect(payload).toBeNull();
  });
});
