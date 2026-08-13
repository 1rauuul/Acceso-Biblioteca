import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin-token";

function resolveJwtSecret(): Uint8Array {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) {
    return new TextEncoder().encode(fromEnv);
  }

  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    throw new Error(
      "JWT_SECRET is required in production. Set it to a random string of at " +
        "least 16 characters. Refusing to start with a missing or too-short " +
        "secret because anyone with the source code could forge admin sessions."
    );
  }

  // Development-only fallback. Loud, single-shot warning to make the risk
  // obvious if someone copies dev defaults into a real deploy.
  if (!globalThis.__jwtSecretWarned) {
    globalThis.__jwtSecretWarned = true;
    console.warn(
      "[auth] JWT_SECRET is not set; using an insecure development-only " +
        "fallback. Do NOT deploy to production without setting JWT_SECRET."
    );
  }
  return new TextEncoder().encode("dev-secret-change-in-production");
}

declare global {
  var __jwtSecretWarned: boolean | undefined;
}

const JWT_SECRET = resolveJwtSecret();

export async function signToken(payload: {
  sub: string;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; email: string; name: string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
