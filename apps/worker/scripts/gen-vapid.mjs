// Generate a VAPID keypair in the exact format web-push-browser expects.
// Run from apps/worker:  node scripts/gen-vapid.mjs
// IMPORTANT: do NOT use `npx web-push generate-vapid-keys` — this app encrypts
// with web-push-browser, so the keys must come from its own serializer.
import { generateVapidKeys, serializeVapidKeys } from "web-push-browser";

const pair = await generateVapidKeys();
const { publicKey, privateKey } = await serializeVapidKeys(pair);

console.log("VAPID_PUBLIC_KEY=" + publicKey);
console.log("VAPID_PRIVATE_KEY=" + privateKey);
console.log("");
console.log("Set them as Worker secrets:");
console.log("  wrangler secret put VAPID_PUBLIC_KEY");
console.log("  wrangler secret put VAPID_PRIVATE_KEY");
console.log("The web client fetches the public key from /api/push/public-key automatically.");
