import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateVapidKeys, serializeVapidKeys } from "web-push-browser";
import { sendPush } from "../src/push/send";
import type { PushTarget, VapidDetails } from "../src/push/send";

// We generate real VAPID keys once so deserializeVapidKeys doesn't throw during
// the encryption step. The HTTP response is mocked so no real push is sent.
let vapid: VapidDetails;
let target: PushTarget;

// Use a real subscription target with valid-looking base64url keys.
// The p256dh / auth values below are valid base64url — they will be decoded
// by the library when building the encrypted payload, so they must be the right
// lengths: p256dh = uncompressed EC P-256 public key = 65 bytes, auth = 16 bytes.
// We generate them properly via SubtleCrypto so the encryption doesn't throw.
async function makeFakeSubscription(): Promise<PushTarget> {
  // Generate a throwaway P-256 key for the "client" side
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );
  const rawPub = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const authBuf = crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer;

  const toBase64Url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return {
    endpoint: "https://push.example/test-endpoint",
    p256dh: toBase64Url(rawPub),
    auth: toBase64Url(authBuf),
  };
}

beforeEach(async () => {
  // Generate a fresh real VAPID keypair for each test
  const keys = await generateVapidKeys();
  const serialized = await serializeVapidKeys(keys);
  vapid = {
    subject: "mailto:t@e.com",
    publicKey: serialized.publicKey,
    privateKey: serialized.privateKey,
  };
  target = await makeFakeSubscription();
});

describe("sendPush", () => {
  it("returns { dead: false } when push service responds 201", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 201 }));
    const result = await sendPush(target, { title: "Test", body: "Hello" }, vapid);
    expect(result).toEqual({ dead: false });
  });

  it("returns { dead: true } when push service responds 410", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 410 }));
    const result = await sendPush(target, { title: "Test", body: "Hello" }, vapid);
    expect(result).toEqual({ dead: true });
  });

  it("returns { dead: true } when push service responds 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 404 }));
    const result = await sendPush(target, { title: "Test", body: "Hello" }, vapid);
    expect(result).toEqual({ dead: true });
  });
});
