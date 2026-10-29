import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login } from "./actions";
import { SESSION_COOKIE, authConfigured, verifySession } from "@/lib/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; setup?: string }>;
}) {
  const params = await searchParams;
  if (authConfigured()) {
    const secret = process.env.AUTH_SECRET ?? "";
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (await verifySession(token, secret)) redirect("/");
  }

  return (
    <form action={login} className="mx-auto mt-16 grid max-w-sm gap-4 rounded-2xl border border-line bg-card p-6">
      <div>
        <h1 className="font-serif text-3xl">Entrar</h1>
        <p className="mt-2 text-sm text-muted">O usuário e a senha ficam no ambiente do servidor, fora do banco.</p>
      </div>
      {params.setup ? (
        <p className="text-sm text-clay">Defina AUTH_USER, AUTH_PASSWORD e AUTH_SECRET no .env.local e reinicie.</p>
      ) : null}
      {params.erro ? <p className="text-sm text-clay">Usuário ou senha incorretos.</p> : null}
      <label className="block text-sm">
        <span className="text-muted">Usuário</span>
        <input name="user" autoComplete="username" required className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
        />
      </label>
      <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-white">
        Entrar
      </button>
    </form>
  );
}
