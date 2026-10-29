"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteEntry, setEntryAmount, setEntryCounts, setEntryPaid } from "@/app/actions";
import { centsToInput, formatMoney, parseMoney } from "@/lib/format";
import type { EntryView } from "@/lib/types";

export function EntryRow({ entry }: { entry: EntryView }) {
  const [amount, setAmount] = useState(entry.amountCents == null ? "" : centsToInput(entry.amountCents));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setAmount(entry.amountCents == null ? "" : centsToInput(entry.amountCents));
  }, [entry.amountCents, entry.id]);

  function saveAmount() {
    if (!amount.trim()) {
      setError(null);
      if (entry.amountCents != null) startTransition(() => setEntryAmount(entry.id, null));
      return;
    }
    const parsed = parseMoney(amount);
    if (parsed == null) {
      setError("Use um valor como 422,86");
      return;
    }
    setError(null);
    if (parsed === entry.amountCents) return;
    startTransition(() => setEntryAmount(entry.id, parsed));
  }

  return (
    <li className={`grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_11rem_auto] md:items-center ${pending ? "opacity-70" : ""}`}>
      <div className="min-w-0">
        <p className="truncate font-medium">{entry.name}</p>
        <p className="truncate text-sm text-muted">
          {entry.category}
          {entry.progress ? ` · ${entry.progress}` : ""}
        </p>
        {entry.hintCents != null && entry.hintMonth ? (
          <p className="text-sm text-muted">
            em {entry.hintMonth}: {formatMoney(entry.hintCents)}
          </p>
        ) : null}
        {error ? <p className="text-sm text-clay">{error}</p> : null}
        {!entry.countsInTotal && !entry.invoiceDetail ? (
          <button
            type="button"
            className="mt-1 text-sm text-moss underline-offset-2 hover:underline"
            onClick={() => startTransition(() => setEntryCounts(entry.id, true))}
          >
            Incluir na soma
          </button>
        ) : null}
        {entry.manual ? (
          <button
            type="button"
            className="mt-1 block text-sm text-muted underline-offset-2 hover:underline"
            onClick={() => startTransition(() => deleteEntry(entry.id))}
          >
            Apagar lançamento
          </button>
        ) : null}
      </div>
      <label className="block">
        <span className="sr-only">Valor de {entry.name}</span>
        <input
          inputMode="decimal"
          value={amount}
          placeholder={entry.amountCents == null ? "sem valor" : undefined}
          onChange={(event) => setAmount(event.target.value)}
          onBlur={saveAmount}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-right tabular-nums"
        />
      </label>
      {entry.invoiceDetail ? (
        <span className="text-sm text-muted md:text-right">Na fatura</span>
      ) : (
        <button
          type="button"
          aria-pressed={entry.paid}
          onClick={() => startTransition(() => setEntryPaid(entry.id, !entry.paid))}
          className={`rounded-full px-4 py-2 text-sm ${entry.paid ? "bg-moss text-white" : "border border-line bg-white text-ink"}`}
        >
          {entry.paid ? "Pago" : "Pagar"}
        </button>
      )}
    </li>
  );
}
