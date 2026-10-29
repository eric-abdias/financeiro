"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

export function Nav() {
  const path = usePathname();
  if (path === "/login") return null;
  const year = new Date().getFullYear();
  const items = [
    { href: "/", label: "Mês", active: path === "/" || path.startsWith("/mes") },
    { href: "/compromissos", label: "Compromissos", active: path.startsWith("/compromissos") },
    { href: `/ano/${year}`, label: "Ano", active: path.startsWith("/ano") },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-serif text-xl text-ink">
          Financeiro
        </Link>
        <nav className="flex gap-1 rounded-full bg-sand p-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-sm ${item.active ? "bg-card text-ink shadow-sm" : "text-muted"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logout}>
          <button type="submit" className="text-sm text-muted">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
