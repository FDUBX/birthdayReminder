import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  userId: number;
}

const ALG = "HS256";

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret));
    if (typeof payload.userId !== "number") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
