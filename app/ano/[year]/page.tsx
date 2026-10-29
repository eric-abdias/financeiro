import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { padMonth } from "@/lib/dates";
import { loadYear } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import type { MonthTotals } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  return { title: year };
}

function tone(cents: number): string {
  if (cents > 0) return "text-moss";
  if (cents < 0) return "text-clay";
  return "text-ink";
}

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  if (!/^\d{4}$/.test(yearParam)) notFound();
  const year = Number(yearParam);
  const db = await getDb();
  const months = loadYear(db, year);
  const totals = months.reduce<MonthTotals>(
    (sum, month) => ({
      income: sum.income + month.totals.income,
      expenses: sum.expenses + month.totals.expenses,
      paid: sum.paid + month.totals.paid,
      open: sum.open + month.totals.open,
      saldoHoje: sum.saldoHoje + month.totals.saldoHoje,
      saldoTudo: sum.saldoTudo + month.totals.saldoTudo,
    }),
    { income: 0, expenses: 0, paid: 0, open: 0, saldoHoje: 0, saldoTudo: 0 },
  );
  const columns = [
    { key: "income", label: "Receita" },
    { key: "expenses", label: "Despesas" },
    { key: "paid", label: "Já pago" },
    { key: "open", label: "Falta" },
    { key: "saldoHoje", label: "Saldo de hoje" },
    { key: "saldoTudo", label: "Se pagar tudo" },
  ] as const;

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/ano/${year - 1}`} className="text-sm text-muted">
          ← {year - 1}
        </Link>
        <h1 className="font-serif text-3xl">{year}</h1>
        <Link href={`/ano/${year + 1}`} className="text-sm text-muted">
          {year + 1} →
        </Link>
      </div>
      <p className="text-sm text-muted">Os doze meses saem dos lançamentos. Não há aba nova para copiar.</p>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-3 font-medium">Mês</th>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-3 text-right font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3">
                  <Link href={`/mes/${year}-${padMonth(month.month)}`} className="font-medium">
                    {month.label}
                  </Link>
                </td>
                {columns.map((column) => {
                  const value = month.totals[column.key];
                  const colored = column.key === "saldoHoje" || column.key === "saldoTudo";
                  return (
                    <td key={column.key} className={`px-3 py-3 text-right tabular-nums ${colored ? tone(value) : ""}`}>
                      {month.persisted ? formatMoney(value) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-sand">
              <th className="px-4 py-3 text-left font-medium">Total</th>
              {columns.map((column) => {
                const value = totals[column.key];
                const colored = column.key === "saldoHoje" || column.key === "saldoTudo";
                return (
                  <td key={column.key} className={`px-3 py-3 text-right font-medium tabular-nums ${colored ? tone(value) : ""}`}>
                    {formatMoney(value)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
