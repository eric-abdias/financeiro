import { getDb } from "../lib/db";
import { loadMonth } from "../lib/finance";
import { formatMoney } from "../lib/format";
import type { EntryView } from "../lib/types";

const expected = {
  income: 485483,
  expenses: 666401,
  paid: 473569,
  open: 192832,
  saldoHoje: 11914,
  saldoTudo: -180918,
};

function find(groups: EntryView[][], name: string): EntryView | undefined {
  for (const group of groups) {
    const found = group.find((entry) => entry.name === name);
    if (found) return found;
  }
  return undefined;
}

function groupOf(month: { falta: EntryView[]; pagos: EntryView[]; fatura: EntryView[]; fora: EntryView[] }, entry: EntryView) {
  if (month.falta.includes(entry)) return "falta";
  if (month.pagos.includes(entry)) return "pagos";
  if (month.fatura.includes(entry)) return "fatura";
  return "fora";
}

async function main() {
const db = await getDb();
const now = new Date(2026, 9, 29);
const month = loadMonth(db, 2026, 10, now);
const groups = [month.falta, month.pagos, month.fatura, month.fora];

console.log(month.label);
console.log(
  `receita ${formatMoney(month.totals.income)} | despesas ${formatMoney(month.totals.expenses)} | pago ${formatMoney(month.totals.paid)} | falta ${formatMoney(month.totals.open)} | hoje ${formatMoney(month.totals.saldoHoje)} | tudo ${formatMoney(month.totals.saldoTudo)}`,
);
console.log("base", month.incomeBaseCents, "extra", month.incomeExtraCents);
for (const [label, entries] of [
  ["falta", month.falta],
  ["pagos", month.pagos],
  ["fatura", month.fatura],
  ["fora", month.fora],
] as const) {
  console.log(`\n${label}`);
  for (const entry of entries) {
    console.log(`- ${entry.name}: ${entry.amountCents == null ? "sem valor" : formatMoney(entry.amountCents)} ${entry.paid ? "pago" : "aberto"}`);
  }
}

const failures: string[] = [];
for (const [key, value] of Object.entries(expected)) {
  const actual = month.totals[key as keyof typeof expected];
  if (actual !== value) failures.push(`${key}: esperado ${value}, veio ${actual}`);
}

const checks: [string, number | null, boolean, "falta" | "pagos" | "fora"][] = [
  ["Sofia", null, false, "fora"],
  ["Enel", 42286, false, "falta"],
  ["Internet", 10627, false, "falta"],
  ["Celular", 6839, false, "falta"],
  ["Nu PJ", 130080, false, "falta"],
  ["NuCel", 3000, false, "falta"],
  ["CNE", 124235, true, "pagos"],
  ["Livina", 107284, true, "pagos"],
  ["Nu PF Empréstimo", 20173, true, "pagos"],
  ["MP PF", 46323, true, "pagos"],
  ["MP Empréstimo", 39124, true, "pagos"],
  ["Nu PF", 65568, true, "pagos"],
  ["DAS", 6424, true, "pagos"],
  ["Nu PJ Giro", 64438, true, "pagos"],
];

for (const [name, amount, paid, group] of checks) {
  const entry = find(groups, name);
  if (!entry) {
    failures.push(`${name} não apareceu`);
    continue;
  }
  const actualGroup = groupOf(month, entry);
  if (actualGroup !== group) failures.push(`${name} está em ${actualGroup}, esperado ${group}`);
  if (entry.amountCents !== amount) failures.push(`${name} valor ${entry.amountCents}, esperado ${amount}`);
  if (entry.paid !== paid) failures.push(`${name} pago ${entry.paid}, esperado ${paid}`);
}

for (const name of ["Prime", "VPS Hostinger", "YouTube", "Google", "Microsoft", "Meli+"]) {
  const entry = find(groups, name);
  if (!entry || !entry.invoiceDetail || entry.countsInTotal) failures.push(`${name} deveria estar dentro da fatura`);
}

const november = loadMonth(db, 2026, 11, now);
const removed = ["Netflix", "Apple", "Carrefour", "Porto Motor", "Samsung 10x", "Nu Parcelamento 6x", "Tales Radiador", "SAS Carrefour"];
for (const name of removed) {
  if (find(groups, name)) failures.push(`${name} ainda está em outubro`);
  if (find([november.falta, november.pagos, november.fatura, november.fora], name)) {
    failures.push(`${name} ainda está em novembro`);
  }
}
if (november.totals.expenses !== 336751) failures.push(`novembro despesas ${november.totals.expenses}, esperado 336751`);
if (november.falta.find((entry) => entry.name === "Internet")?.amountCents !== 10627) {
  failures.push("novembro deveria trazer a internet com o valor fixo");
}

const december = loadMonth(db, 2026, 12, now);
if (december.falta.some((entry) => entry.name === "Nu PJ Giro") || december.pagos.some((entry) => entry.name === "Nu PJ Giro")) {
  failures.push("Nu PJ Giro ainda aparece em dezembro");
}
const nuPfDecember = find([december.falta, december.pagos, december.fatura, december.fora], "Nu PF Empréstimo");
if (!nuPfDecember || nuPfDecember.amountCents !== 20173) failures.push("dezembro deveria ter a última parcela do Nu PF");

const january = loadMonth(db, 2027, 1, now);
if (find([january.falta, january.pagos, january.fatura, january.fora], "Nu PF Empréstimo")) {
  failures.push("Nu PF Empréstimo ainda aparece em janeiro");
}
if (november.totals.paid !== 0) failures.push("novembro não deveria ter pagamento previsto da planilha");
if (november.falta.some((entry) => entry.name === "Enel" && entry.amountCents != null)) {
  failures.push("novembro herdou valor de Enel da planilha");
}

const july = loadMonth(db, 2026, 7, now);
if (!find([july.falta, july.pagos, july.fatura, july.fora], "Carrefour")) {
  failures.push("julho perdeu o Carrefour do histórico");
}

if (failures.length) {
  console.error("\nFalhou:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nOutubro e novembro conferem.");
}

main();
