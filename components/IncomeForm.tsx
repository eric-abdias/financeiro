"use client";

import { useState, useTransition } from "react";
import { setIncome } from "@/app/actions";
import { centsToInput, parseMoney } from "@/lib/format";

export function IncomeForm({
  year,
  month,
  baseCents,
  extraCents,
}: {
  year: number;
  month: number;
  baseCents: number;
  extraCents: number;
}) {
  const [base, setBase] = useState(centsToInput(baseCents));
  const [extra, setExtra] = useState(centsToInput(extraCents));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const parsedBase = base.trim() ? parseMoney(base) : 0;
    const parsedExtra = extra.trim() ? parseMoney(extra) : 0;
    if (parsedBase == null || parsedExtra == null) {
      setError("Use valores como 4.850,00");
      return;
    }
    setError(null);
    startTransition(() => setIncome(year, month, parsedBase, parsedExtra));
  }

  return (
    <form
      className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label className="block text-sm">
        <span className="text-muted">Base</span>
        <input
          value={base}
          onChange={(event) => setBase(event.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 tabular-nums"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Extras</span>
        <input
          value={extra}
          onChange={(event) => setExtra(event.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 tabular-nums"
        />
      </label>
      <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-2 text-sm text-white">
        Atualizar receita
      </button>
      <p className="text-sm text-muted sm:col-span-3">
        Se a base mudar, os meses seguintes que ainda estavam com esse valor acompanham. O extra fica só neste mês.
      </p>
      {error ? <p className="text-sm text-clay sm:col-span-3">{error}</p> : null}
    </form>
  );
}
