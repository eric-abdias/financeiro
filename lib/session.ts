const encoder = new TextEncoder();

export const SESSION_COOKIE = "financeiro_session";

export function cookiePath(): string {
  const value = (process.env.BASE_PATH ?? "").trim().replace(/\/$/, "");
  if (!value || value === "/") return "/";
  return value.startsWith("/") ? value : `/${value}`;
}
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function b64url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlEncode(text: string): string {
  return b64url(encoder.encode(text));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return b64url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

export function authConfigured(): boolean {
  return Boolean(process.env.AUTH_USER && process.env.AUTH_PASSWORD && process.env.AUTH_SECRET);
}

export async function signSession(user: string, secret: string, now = Date.now()): Promise<string> {
  const payload = b64urlEncode(JSON.stringify({ u: user, e: now + SESSION_MAX_AGE * 1000 }));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, await hmac(secret, payload))) return false;
  try {
    const padded = payload.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((payload.length + 3) % 4);
    const json = JSON.parse(atob(padded)) as { e?: number };
    return typeof json.e === "number" && json.e > Date.now();
  } catch {
    return false;
  }
}
