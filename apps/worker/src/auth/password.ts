const ITERATIONS = 100_000;
const KEY_LEN = 32;

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer as ArrayBuffer);
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, KEY_LEN * 8);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${toB64(salt.buffer)}$${toB64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  const scheme = parts[0];
  const iterStr = parts[1];
  const saltB64 = parts[2];
  const hashB64 = parts[3];
  if (!scheme || !iterStr || !saltB64 || !hashB64) return false;
  if (scheme !== "pbkdf2") return false;
  const salt = fromB64(saltB64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: Number(iterStr), hash: "SHA-256" },
    key,
    KEY_LEN * 8,
  );
  return toB64(bits) === hashB64;
}
