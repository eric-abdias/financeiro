"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, authConfigured, cookiePath, signSession } from "@/lib/session";

function sameSecret(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function login(formData: FormData) {
  if (!authConfigured()) redirect("/login?setup=1");
  const user = String(formData.get("user") || "");
  const password = String(formData.get("password") || "");
  const expectedUser = process.env.AUTH_USER ?? "";
  const expectedPassword = process.env.AUTH_PASSWORD ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  if (!sameSecret(user, expectedUser) || !sameSecret(password, expectedPassword)) {
    redirect("/login?erro=1");
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(expectedUser, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: cookiePath(),
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: cookiePath() });
  redirect("/login");
}
