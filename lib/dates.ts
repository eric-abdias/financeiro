export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function monthKey(year: number, month: number): number {
  return year * 12 + month;
}

export function isBeforeMonth(
  year: number,
  month: number,
  now: Date,
): boolean {
  return monthKey(year, month) < monthKey(now.getFullYear(), now.getMonth() + 1);
}

export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const absolute = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = absolute - nextYear * 12 + 1;
  return { year: nextYear, month: nextMonth };
}

export function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

export function yearMonthKey(year: number, month: number): string {
  return `${year}-${padMonth(month)}`;
}
