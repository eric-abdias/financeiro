import { addMonths, isBeforeMonth, MONTHS, MONTHS_SHORT, monthLabel, yearMonthKey } from "./dates";
import { insertId, bool, num, type DB } from "./sql";
import { summarize } from "./totals";
import type {
  CategoryOption,
  CommitmentView,
  EntryView,
  Kind,
  MonthView,
  YearMonthView,
} from "./types";

type CommitmentRow = {
  id: number;
  name: string;
  category_id: number;
  kind: Kind;
  amount_cents: number | null;
  due_month: number | null;
  installment_count: number | null;
  installment_start: string | null;
  counts_in_total: number;
  invoice_detail: number;
  active: number;
  notes: string | null;
  sort: number;
};

type EntryRow = {
  id: number;
  month_id: number;
  commitment_id: number | null;
  name: string;
  category_id: number | null;
  amount_cents: number | null;
  paid: number;
  counts_in_total: number;
  invoice_detail: number;
  manual: number;
  sort: number;
};

type MonthRow = {
  id: number;
  year: number;
  month: number;
  income_base_cents: number;
  income_extra_cents: number;
};

type CategoryRow = {
  id: number;
  parent_id: number | null;
  name: string;
  sort: number;
};

function categories(db: DB): Map<number, CategoryRow> {
  const rows = db.prepare("SELECT id, parent_id, name, sort FROM categories").all() as CategoryRow[];
  return new Map(rows.map((row) => [Number(row.id), { ...row, id: Number(row.id), parent_id: row.parent_id == null ? null : Number(row.parent_id), sort: Number(row.sort) }]));
}

function categoryPath(byId: Map<number, CategoryRow>, id: number | null): string {
  if (id == null) return "";
  const parts: string[] = [];
  let current = byId.get(id);
  let guard = 0;
  while (current && guard < 6) {
    parts.unshift(current.name);
    current = current.parent_id == null ? undefined : byId.get(current.parent_id);
    guard += 1;
  }
  return parts.join(" / ");
}

function categoryOptions(byId: Map<number, CategoryRow>): CategoryOption[] {
  const children = new Map<number | null, CategoryRow[]>();
  for (const category of byId.values()) {
    const list = children.get(category.parent_id) ?? [];
    list.push(category);
    children.set(category.parent_id, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "pt"));
  }
  const ordered: CategoryOption[] = [];
  function walk(parentId: number | null) {
    for (const category of children.get(parentId) ?? []) {
      ordered.push({ id: category.id, label: categoryPath(byId, category.id) });
      walk(category.id);
    }
  }
  walk(null);
  return ordered;
}

export function applies(commitment: CommitmentRow, year: number, month: number): boolean {
  if (!commitment.active) return false;
  if (commitment.kind === "fixed_monthly" || commitment.kind === "variable_monthly" || commitment.kind === "carried_monthly") return true;
  if (commitment.kind === "annual") return commitment.due_month === month;
  if (!commitment.installment_start) return false;
  const [startYear, startMonth] = commitment.installment_start.split("-").map(Number);
  if (!startYear || !startMonth) return false;
  const start = startYear * 12 + (startMonth - 1);
  const here = year * 12 + (month - 1);
  if (commitment.kind === "once") return here === start;
  const count = commitment.installment_count ?? 0;
  if (count <= 0) return false;
  return here >= start && here < start + count;
}

function progressLabel(commitment: CommitmentRow, year: number, month: number): string | null {
  if (commitment.kind !== "installment" || !commitment.installment_start || !commitment.installment_count) {
    return null;
  }
  const [startYear, startMonth] = commitment.installment_start.split("-").map(Number);
  const index = year * 12 + month - (startYear * 12 + startMonth) + 1;
  const end = addMonths(startYear, startMonth, commitment.installment_count - 1);
  return `${index} de ${commitment.installment_count} · até ${MONTHS_SHORT[end.month - 1]}/${end.year}`;
}

function commitmentHint(commitment: CommitmentRow): string {
  if (!commitment.active) return "Inativo. Não entra nos próximos meses.";
  if (commitment.invoice_detail) return "Já sai na fatura do cartão. O valor é só para saber quanto foi.";
  if (commitment.kind === "fixed_monthly") {
    return commitment.amount_cents == null
      ? "Entra todo mês, sem valor definido."
      : "Entra todo mês com esse valor. Um mês que ainda está vazio recebe o valor do compromisso.";
  }
  if (commitment.kind === "carried_monthly") {
    return "O valor deste mês passa para os seguintes que ainda estavam com esse valor, ou vazios. Zero também segue.";
  }
  if (commitment.kind === "variable_monthly") return "A linha entra todo mês e o valor é preenchido quando a conta chega.";
  if (commitment.kind === "annual") {
    return commitment.due_month
      ? `Entra em ${MONTHS[commitment.due_month - 1].toLowerCase()} de cada ano.`
      : "Informe o mês do ano para a conta aparecer.";
  }
  if (commitment.kind === "installment") {
    if (!commitment.installment_start || !commitment.installment_count) {
      return "Informe o início, a quantidade e o valor para a parcela aparecer.";
    }
    const [startYear, startMonth] = commitment.installment_start.split("-").map(Number);
    const end = addMonths(startYear, startMonth, commitment.installment_count - 1);
    return `${commitment.installment_count} parcelas, de ${MONTHS_SHORT[startMonth - 1]}/${startYear} até ${MONTHS_SHORT[end.month - 1]}/${end.year}.`;
  }
  if (!commitment.installment_start) return "Informe o mês deste lançamento.";
  return `Entra só em ${commitment.installment_start}.`;
}

function defaultIncome(db: DB, year: number, month: number): { base: number; extra: number } {
  const previous = addMonths(year, month, -1);
  const row = db
    .prepare("SELECT income_base_cents, income_extra_cents FROM months WHERE year = ? AND month = ?")
    .get(previous.year, previous.month) as { income_base_cents: number; income_extra_cents: number } | undefined;
  if (!row) return { base: 485000, extra: 0 };
  const base = Number(row.income_base_cents) > 0
    ? Number(row.income_base_cents)
    : Number(row.income_base_cents) + Number(row.income_extra_cents);
  if (base <= 0) return { base: 485000, extra: 0 };
  return { base, extra: 0 };
}

function mapCommitment(row: Record<string, unknown>): CommitmentRow {
  return {
    id: num(row.id),
    name: String(row.name),
    category_id: num(row.category_id),
    kind: String(row.kind) as Kind,
    amount_cents: row.amount_cents == null ? null : num(row.amount_cents),
    due_month: row.due_month == null ? null : num(row.due_month),
    installment_count: row.installment_count == null ? null : num(row.installment_count),
    installment_start: row.installment_start == null ? null : String(row.installment_start),
    counts_in_total: num(row.counts_in_total),
    invoice_detail: row.invoice_detail == null ? 0 : num(row.invoice_detail),
    active: num(row.active),
    notes: row.notes == null ? null : String(row.notes),
    sort: num(row.sort),
  };
}

function liveCommitments(db: DB): CommitmentRow[] {
  const rows = db.prepare("SELECT * FROM commitments WHERE active = 1 ORDER BY sort, id").all() as Record<string, unknown>[];
  return rows.map(mapCommitment);
}

function dropExpired(db: DB, monthId: number, year: number, month: number) {
  const rows = db
    .prepare(
      `SELECT e.id AS entry_id, e.paid, c.*
       FROM entries e
       JOIN commitments c ON c.id = e.commitment_id
       WHERE e.month_id = ? AND e.manual = 0`,
    )
    .all(monthId) as Record<string, unknown>[];
  for (const row of rows) {
    if (bool(row.paid)) continue;
    if (!applies(mapCommitment(row), year, month)) {
      db.prepare("DELETE FROM entries WHERE id = ?").run(Number(row.entry_id));
    }
  }
}

function previousCarriedAmount(db: DB, commitmentId: number, year: number, month: number): number | null | undefined {
  const row = db
    .prepare(
      `SELECT e.amount_cents AS amount_cents
       FROM entries e
       JOIN months m ON m.id = e.month_id
       WHERE e.commitment_id = ?
         AND (m.year < ? OR (m.year = ? AND m.month < ?))
       ORDER BY m.year DESC, m.month DESC
       LIMIT 1`,
    )
    .get(commitmentId, year, year, month) as { amount_cents: number | null } | undefined;
  if (!row) return undefined;
  return row.amount_cents == null ? null : Number(row.amount_cents);
}

function openingAmount(db: DB, commitment: CommitmentRow, year: number, month: number): number | null {
  if (commitment.kind === "variable_monthly") return null;
  if (commitment.kind === "carried_monthly") {
    const previous = previousCarriedAmount(db, commitment.id, year, month);
    return previous === undefined ? commitment.amount_cents : previous;
  }
  return commitment.amount_cents;
}

export function ensureEntries(db: DB, monthId: number, year: number, month: number) {
  dropExpired(db, monthId, year, month);
  const existing = new Set(
    (db.prepare("SELECT commitment_id FROM entries WHERE month_id = ? AND commitment_id IS NOT NULL").all(monthId) as { commitment_id: number }[])
      .map((row) => Number(row.commitment_id)),
  );
  for (const commitment of liveCommitments(db)) {
    if (!applies(commitment, year, month) || existing.has(commitment.id)) continue;
    const invoice = commitment.invoice_detail ? 1 : 0;
    insertId(
      db,
      `INSERT INTO entries
        (month_id, commitment_id, name, category_id, amount_cents, paid, counts_in_total, invoice_detail, manual, sort)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, ?)`,
      monthId,
      commitment.id,
      commitment.name,
      commitment.category_id,
      openingAmount(db, commitment, year, month),
      invoice ? 0 : commitment.counts_in_total,
      invoice,
      1000 + commitment.sort,
    );
  }
}

function emptyMonth(year: number, month: number, options: CategoryOption[]): MonthView {
  return {
    persisted: false,
    year,
    month,
    label: monthLabel(year, month),
    incomeBaseCents: 0,
    incomeExtraCents: 0,
    totals: summarize(0, []),
    falta: [],
    pagos: [],
    fatura: [],
    faturaTotal: 0,
    fora: [],
    categories: options,
  };
}

export function loadMonth(db: DB, year: number, month: number, now = new Date()): MonthView {
  const byId = categories(db);
  const options = categoryOptions(byId);
  let row = db.prepare("SELECT * FROM months WHERE year = ? AND month = ?").get(year, month) as MonthRow | undefined;
  if (!row) {
    if (isBeforeMonth(year, month, now)) return emptyMonth(year, month, options);
    const income = defaultIncome(db, year, month);
    const id = insertId(
      db,
      "INSERT INTO months (year, month, income_base_cents, income_extra_cents) VALUES (?, ?, ?, ?)",
      year,
      month,
      income.base,
      income.extra,
    );
    row = {
      id,
      year,
      month,
      income_base_cents: income.base,
      income_extra_cents: income.extra,
    };
  }
  if (!isBeforeMonth(year, month, now)) ensureEntries(db, Number(row.id), year, month);

  const entries = db.prepare("SELECT * FROM entries WHERE month_id = ? ORDER BY sort, id").all(Number(row.id)) as EntryRow[];
  const commitmentRows = db.prepare("SELECT * FROM commitments").all() as Record<string, unknown>[];
  const commitmentById = new Map(commitmentRows.map((item) => [num(item.id), mapCommitment(item)]));
  const previous = addMonths(year, month, -1);
  const previousMonth = db.prepare("SELECT id FROM months WHERE year = ? AND month = ?").get(previous.year, previous.month) as { id: number } | undefined;
  const previousAmounts = new Map<number, number | null>();
  if (previousMonth) {
    const previousEntries = db.prepare("SELECT commitment_id, amount_cents FROM entries WHERE month_id = ? AND commitment_id IS NOT NULL").all(Number(previousMonth.id)) as { commitment_id: number; amount_cents: number | null }[];
    for (const entry of previousEntries) {
      previousAmounts.set(Number(entry.commitment_id), entry.amount_cents == null ? null : Number(entry.amount_cents));
    }
  }

  const views: EntryView[] = entries.map((entry) => {
    const commitment = entry.commitment_id == null ? undefined : commitmentById.get(Number(entry.commitment_id));
    const amountCents = entry.amount_cents == null ? null : Number(entry.amount_cents);
    const hintCents = commitment && amountCents == null ? previousAmounts.get(commitment.id) ?? null : null;
    return {
      id: Number(entry.id),
      name: entry.name,
      category: categoryPath(byId, entry.category_id == null ? null : Number(entry.category_id)),
      amountCents,
      paid: bool(entry.paid),
      countsInTotal: bool(entry.counts_in_total),
      invoiceDetail: bool(entry.invoice_detail),
      hintCents: hintCents ?? null,
      hintMonth: hintCents == null ? null : MONTHS[previous.month - 1].toLowerCase(),
      progress: commitment ? progressLabel(commitment, year, month) : null,
      manual: bool(entry.manual),
      carried: commitment?.kind === "carried_monthly",
    };
  });

  const incomeBaseCents = Number(row.income_base_cents);
  const incomeExtraCents = Number(row.income_extra_cents);
  const fatura = views.filter((entry) => entry.invoiceDetail);
  return {
    persisted: true,
    year,
    month,
    label: monthLabel(year, month),
    incomeBaseCents,
    incomeExtraCents,
    totals: summarize(incomeBaseCents + incomeExtraCents, views),
    falta: views.filter((entry) => entry.countsInTotal && !entry.paid && !entry.invoiceDetail),
    pagos: views.filter((entry) => entry.countsInTotal && entry.paid && !entry.invoiceDetail),
    fatura,
    faturaTotal: fatura.reduce((sum, entry) => sum + (entry.amountCents ?? 0), 0),
    fora: views.filter((entry) => !entry.countsInTotal && !entry.invoiceDetail),
    categories: options,
  };
}

export function loadYear(db: DB, year: number, now = new Date()): YearMonthView[] {
  return MONTHS.map((_, index) => {
    const month = loadMonth(db, year, index + 1, now);
    return {
      year,
      month: index + 1,
      label: MONTHS[index],
      persisted: month.persisted,
      totals: month.totals,
    };
  });
}

export function listCommitments(db: DB): CommitmentView[] {
  const byId = categories(db);
  const rows = db.prepare("SELECT * FROM commitments ORDER BY sort, id").all() as Record<string, unknown>[];
  return rows.map((row) => {
    const commitment = mapCommitment(row);
    const path = categoryPath(byId, commitment.category_id);
    const root = path.split(" / ")[0] ?? path;
    const rootCategory = [...byId.values()].find((category) => category.parent_id == null && category.name === root);
    return {
      id: commitment.id,
      name: commitment.name,
      categoryId: commitment.category_id,
      categoryPath: path,
      root,
      rootSort: rootCategory?.sort ?? 9999,
      kind: commitment.kind,
      amountCents: commitment.amount_cents,
      dueMonth: commitment.due_month,
      installmentCount: commitment.installment_count,
      installmentStart: commitment.installment_start,
      countsInTotal: bool(commitment.counts_in_total),
      invoiceDetail: bool(commitment.invoice_detail),
      active: bool(commitment.active),
      notes: commitment.notes,
      hint: commitmentHint(commitment),
    };
  });
}

export function categoryChoices(db: DB): CategoryOption[] {
  return categoryOptions(categories(db));
}

function nonPastClause() {
  return "month_id IN (SELECT id FROM months WHERE year > ? OR (year = ? AND month >= ?))";
}

export function resyncCommitment(db: DB, commitmentId: number, now = new Date()) {
  const row = db.prepare("SELECT * FROM commitments WHERE id = ?").get(commitmentId) as Record<string, unknown> | undefined;
  if (!row) return;
  const commitment = mapCommitment(row);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const invoice = commitment.invoice_detail ? 1 : 0;
  if (commitment.kind !== "variable_monthly" && commitment.kind !== "carried_monthly" && commitment.amount_cents != null) {
    db.prepare(
      `UPDATE entries SET amount_cents = ? WHERE commitment_id = ? AND amount_cents IS NULL AND ${nonPastClause()}`,
    ).run(commitment.amount_cents, commitment.id, year, year, month);
  }
  db.prepare(
    `UPDATE entries SET name = ?, category_id = ?, counts_in_total = ?, invoice_detail = ? WHERE commitment_id = ? AND ${nonPastClause()}`,
  ).run(
    commitment.name,
    commitment.category_id,
    invoice ? 0 : commitment.counts_in_total,
    invoice,
    commitment.id,
    year,
    year,
    month,
  );

  const months = db.prepare("SELECT * FROM months").all() as MonthRow[];
  for (const item of months) {
    if (isBeforeMonth(Number(item.year), Number(item.month), now)) continue;
    const entry = db
      .prepare("SELECT id, paid FROM entries WHERE month_id = ? AND commitment_id = ?")
      .get(Number(item.id), commitment.id) as { id: number; paid: number } | undefined;
    const on = applies(commitment, Number(item.year), Number(item.month));
    if (on && !entry) {
      const detail = commitment.invoice_detail ? 1 : 0;
      insertId(
        db,
        `INSERT INTO entries
          (month_id, commitment_id, name, category_id, amount_cents, paid, counts_in_total, invoice_detail, manual, sort)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, ?)`,
        Number(item.id),
        commitment.id,
        commitment.name,
        commitment.category_id,
        openingAmount(db, commitment, Number(item.year), Number(item.month)),
        detail ? 0 : commitment.counts_in_total,
        detail,
        1000 + commitment.sort,
      );
    }
    if (!on && entry && !bool(entry.paid)) {
      db.prepare("DELETE FROM entries WHERE id = ?").run(Number(entry.id));
    }
  }
}

export function ensureCurrentMonth(db: DB, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  loadMonth(db, year, month, now);
}

export function saveEntryAmount(db: DB, entryId: number, amountCents: number | null) {
  const row = db
    .prepare(
      `SELECT e.amount_cents, e.commitment_id, m.year, m.month, c.kind
       FROM entries e
       JOIN months m ON m.id = e.month_id
       LEFT JOIN commitments c ON c.id = e.commitment_id
       WHERE e.id = ?`,
    )
    .get(entryId) as
    | { amount_cents: number | null; commitment_id: number | null; year: number; month: number; kind: string | null }
    | undefined;
  if (!row) return;
  const previous = row.amount_cents == null ? null : Number(row.amount_cents);
  db.prepare("UPDATE entries SET amount_cents = ? WHERE id = ?").run(amountCents, entryId);
  if (row.kind !== "carried_monthly" || row.commitment_id == null || previous === amountCents) return;
  db.prepare(
    `UPDATE entries
     SET amount_cents = ?
     WHERE commitment_id = ?
       AND month_id IN (SELECT id FROM months WHERE year > ? OR (year = ? AND month > ?))
       AND (amount_cents IS NULL OR (? IS NOT NULL AND amount_cents = ?))`,
  ).run(amountCents, Number(row.commitment_id), Number(row.year), Number(row.year), Number(row.month), previous, previous);
  const latest = db
    .prepare(
      `SELECT e.amount_cents AS amount_cents
       FROM entries e
       JOIN months m ON m.id = e.month_id
       WHERE e.commitment_id = ?
       ORDER BY m.year DESC, m.month DESC
       LIMIT 1`,
    )
    .get(Number(row.commitment_id)) as { amount_cents: number | null } | undefined;
  if (!latest) return;
  db.prepare("UPDATE commitments SET amount_cents = ? WHERE id = ?").run(latest.amount_cents, Number(row.commitment_id));
}

export function saveIncome(db: DB, year: number, month: number, baseCents: number, extraCents: number) {
  const existing = db.prepare("SELECT id, income_base_cents FROM months WHERE year = ? AND month = ?").get(year, month) as
    | { id: number; income_base_cents: number }
    | undefined;
  if (!existing) {
    insertId(
      db,
      "INSERT INTO months (year, month, income_base_cents, income_extra_cents) VALUES (?, ?, ?, ?)",
      year,
      month,
      baseCents,
      extraCents,
    );
    return;
  }
  const previousBase = Number(existing.income_base_cents);
  db.prepare("UPDATE months SET income_base_cents = ?, income_extra_cents = ? WHERE id = ?").run(baseCents, extraCents, Number(existing.id));
  if (previousBase === baseCents) return;
  db.prepare(
    `UPDATE months SET income_base_cents = ?
     WHERE income_base_cents = ?
       AND (year > ? OR (year = ? AND month > ?))`,
  ).run(baseCents, previousBase, year, year, month);
}

export function addManualEntry(
  db: DB,
  year: number,
  month: number,
  input: { name: string; categoryId: number; amountCents: number | null; countsInTotal: boolean; invoiceDetail?: boolean },
  now = new Date(),
) {
  const view = loadMonth(db, year, month, now);
  if (!view.persisted) {
    const income = isBeforeMonth(year, month, now) ? { base: 0, extra: 0 } : defaultIncome(db, year, month);
    insertId(
      db,
      "INSERT INTO months (year, month, income_base_cents, income_extra_cents) VALUES (?, ?, ?, ?)",
      year,
      month,
      view.incomeBaseCents || income.base,
      view.incomeExtraCents || income.extra,
    );
  }
  const monthRow = db.prepare("SELECT id FROM months WHERE year = ? AND month = ?").get(year, month) as { id: number };
  const maxSort = db.prepare("SELECT COALESCE(MAX(sort), 0) AS n FROM entries WHERE month_id = ?").get(Number(monthRow.id)) as { n: number };
  insertId(
    db,
    `INSERT INTO entries
      (month_id, commitment_id, name, category_id, amount_cents, paid, counts_in_total, invoice_detail, manual, sort)
     VALUES (?, NULL, ?, ?, ?, 0, ?, ?, 1, ?)`,
    Number(monthRow.id),
    input.name,
    input.categoryId,
    input.amountCents,
    input.invoiceDetail ? 0 : input.countsInTotal ? 1 : 0,
    input.invoiceDetail ? 1 : 0,
    Number(maxSort.n) + 1,
  );
}

export function createCategory(db: DB, name: string, parentId: number | null) {
  const maxSort = (
    parentId == null
      ? db.prepare("SELECT COALESCE(MAX(sort), 0) AS n FROM categories WHERE parent_id IS NULL").get()
      : db.prepare("SELECT COALESCE(MAX(sort), 0) AS n FROM categories WHERE parent_id = ?").get(parentId)
  ) as { n: number };
  insertId(
    db,
    "INSERT INTO categories (parent_id, name, sort) VALUES (?, ?, ?)",
    parentId,
    name,
    Number(maxSort.n) + 1,
  );
}

export function monthStamp(year: number, month: number): string {
  return yearMonthKey(year, month);
}
