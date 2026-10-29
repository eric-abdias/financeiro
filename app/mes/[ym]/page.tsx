import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addAvulso } from "@/app/actions";
import { EntryRow } from "@/components/EntryRow";
import { IncomeForm } from "@/components/IncomeForm";
import { getDb } from "@/lib/db";
import { addMonths, monthLabel, padMonth } from "@/lib/dates";
import { loadMonth } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import type { EntryView, MonthTotals } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseYearMonth(ym: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ym: string }>;
}): Promise<Metadata> {
  const { ym } = await params;
  const parsed = parseYearMonth(ym);
  return { title: parsed ? monthLabel(parsed.year, parsed.month) : "Mês" };
}

function moneyTone(cents: number): string {
  if (cents > 0) return "text-moss";
  if (cents < 0) return "text-clay";
  return "text-ink";
}

function Summary({ totals }: { totals: MonthTotals }) {
  const cards = [
    { label: "Receita", value: totals.income, tone: "text-ink" },
    { label: "Despesas", value: totals.expenses, tone: "text-ink" },
    { label: "Já pago", value: totals.paid, tone: "text-ink" },
    { label: "Falta pagar", value: totals.open, tone: totals.open > 0 ? "text-amber" : "text-ink" },
    { label: "Saldo de hoje", value: totals.saldoHoje, tone: moneyTone(totals.saldoHoje), note: "receita menos o que já foi pago" },
    { label: "Se pagar tudo", value: totals.saldoTudo, tone: moneyTone(totals.saldoTudo), note: "receita menos as despesas" },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.label} className="rounded-2xl border border-line bg-card px-4 py-3">
          <p className="text-sm text-muted">{card.label}</p>
          <p className={`mt-1 font-serif text-2xl tabular-nums ${card.tone}`}>{formatMoney(card.value)}</p>
          {card.note ? <p className="mt-1 text-xs text-muted">{card.note}</p> : null}
        </article>
      ))}
    </section>
  );
}

function EntryList({ title, total, entries, empty, note }: { title: string; total?: string; entries: EntryView[]; empty: string; note?: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-serif text-xl">{title}</h2>
          {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
        </div>
        {total ? <p className="tabular-nums text-muted">{total}</p> : <p className="text-sm text-muted">não entra nos saldos</p>}
      </header>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function MonthPage({ params }: { params: Promise<{ ym: string }> }) {
  const { ym } = await params;
  const parsed = parseYearMonth(ym);
  if (!parsed) notFound();
  const db = await getDb();
  const month = loadMonth(db, parsed.year, parsed.month);
  const previous = addMonths(parsed.year, parsed.month, -1);
  const next = addMonths(parsed.year, parsed.month, 1);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Link
          href={`/mes/${previous.year}-${padMonth(previous.month)}`}
          aria-label={monthLabel(previous.year, previous.month)}
          className="text-sm text-muted"
        >
          ← <span className="hidden sm:inline">{monthLabel(previous.year, previous.month)}</span>
        </Link>
        <h1 className="text-center font-serif text-3xl">{month.label}</h1>
        <Link
          href={`/mes/${next.year}-${padMonth(next.month)}`}
          aria-label={monthLabel(next.year, next.month)}
          className="text-right text-sm text-muted"
        >
          <span className="hidden sm:inline">{monthLabel(next.year, next.month)}</span> →
        </Link>
      </div>
      <p className="text-sm text-muted">
        O que ficou em aberto continua neste mês. O saldo não passa para o mês seguinte.
      </p>
      <Summary totals={month.totals} />
      <IncomeForm
        year={month.year}
        month={month.month}
        baseCents={month.incomeBaseCents}
        extraCents={month.incomeExtraCents}
      />
      <EntryList
        title="Falta pagar"
        total={formatMoney(month.totals.open)}
        entries={month.falta}
        empty="Nada em aberto com valor."
      />
      <EntryList
        title="Já paguei"
        total={formatMoney(month.totals.paid)}
        entries={month.pagos}
        empty="Nenhum pagamento marcado."
      />
      {month.fatura.length > 0 ? (
        <EntryList
          title="Dentro da fatura"
          total={formatMoney(month.faturaTotal)}
          entries={month.fatura}
          empty=""
          note="Já saem na fatura do cartão. A soma é só para saber quanto foi e não entra no saldo."
        />
      ) : null}
      {month.fora.length > 0 ? (
        <EntryList
          title="Fora da soma"
          entries={month.fora}
          empty=""
        />
      ) : null}
      <details className="rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer font-medium">Lançar gasto avulso</summary>
        <form action={addAvulso} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="year" value={month.year} />
          <input type="hidden" name="month" value={month.month} />
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted">Nome</span>
            <input name="name" required className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Valor</span>
            <input name="amount" inputMode="decimal" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Categoria</span>
            <select name="categoryId" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2">
              {month.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted">No mês</span>
            <select name="place" defaultValue="soma" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2">
              <option value="soma">Entra na soma</option>
              <option value="fatura">Dentro da fatura</option>
              <option value="fora">Fora da soma</option>
            </select>
          </label>
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-white sm:col-span-2 sm:w-fit">
            Adicionar ao mês
          </button>
        </form>
      </details>
    </div>
  );
}
