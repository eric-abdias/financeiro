import type { MonthTotals } from "./types";

export function summarize(
  incomeCents: number,
  entries: { amountCents: number | null; paid: boolean; countsInTotal: boolean }[],
): MonthTotals {
  let expenses = 0;
  let paid = 0;
  for (const entry of entries) {
    if (!entry.countsInTotal || entry.amountCents == null) continue;
    expenses += entry.amountCents;
    if (entry.paid) paid += entry.amountCents;
  }
  return {
    income: incomeCents,
    expenses,
    paid,
    open: expenses - paid,
    saldoHoje: incomeCents - paid,
    saldoTudo: incomeCents - expenses,
  };
}
