export const KINDS = [
  { id: "fixed_monthly", label: "Mensal fixo" },
  { id: "carried_monthly", label: "Mensal que segue" },
  { id: "variable_monthly", label: "Mensal variável" },
  { id: "installment", label: "Parcelamento" },
  { id: "annual", label: "Anual" },
  { id: "once", label: "Avulso" },
] as const;

export type Kind = (typeof KINDS)[number]["id"];

export type CategoryOption = {
  id: number;
  label: string;
};

export type EntryView = {
  id: number;
  name: string;
  category: string;
  amountCents: number | null;
  paid: boolean;
  countsInTotal: boolean;
  invoiceDetail: boolean;
  hintCents: number | null;
  hintMonth: string | null;
  progress: string | null;
  manual: boolean;
  carried: boolean;
};

export type MonthTotals = {
  income: number;
  expenses: number;
  paid: number;
  open: number;
  saldoHoje: number;
  saldoTudo: number;
};

export type MonthView = {
  persisted: boolean;
  year: number;
  month: number;
  label: string;
  incomeBaseCents: number;
  incomeExtraCents: number;
  totals: MonthTotals;
  falta: EntryView[];
  pagos: EntryView[];
  fatura: EntryView[];
  faturaTotal: number;
  fora: EntryView[];
  categories: CategoryOption[];
};

export type CommitmentView = {
  id: number;
  name: string;
  categoryId: number;
  categoryPath: string;
  root: string;
  rootSort: number;
  kind: Kind;
  amountCents: number | null;
  dueMonth: number | null;
  installmentCount: number | null;
  installmentStart: string | null;
  countsInTotal: boolean;
  invoiceDetail: boolean;
  active: boolean;
  notes: string | null;
  hint: string;
};

export type YearMonthView = {
  year: number;
  month: number;
  label: string;
  persisted: boolean;
  totals: MonthTotals;
};
