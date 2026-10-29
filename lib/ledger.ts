import { insertId, type DB } from "./sql";
import { ensureEntries } from "./finance";

const INVOICE_KEYS = ["netflix", "prime", "apple", "hostinger", "youtube", "google", "microsoft"];

const INVOICE_NOTE = "Já sai na fatura do cartão. O valor é só para saber quanto foi.";

function columnExists(db: DB, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.some((item) => item.name === column);
}

function ensureColumn(db: DB, table: string, column: string, definition: string) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function categoryId(db: DB, parentName: string, childName: string): number {
  const parent = db
    .prepare("SELECT id FROM categories WHERE name = ? AND parent_id IS NULL")
    .get(parentName) as { id: number } | undefined;
  if (!parent) throw new Error(`Categoria ${parentName} não encontrada`);
  const existing = db
    .prepare("SELECT id FROM categories WHERE name = ? AND parent_id = ?")
    .get(childName, Number(parent.id)) as { id: number } | undefined;
  if (existing) return Number(existing.id);
  const maxSort = db.prepare("SELECT COALESCE(MAX(sort), 0) AS n FROM categories").get() as { n: number };
  return insertId(
    db,
    "INSERT INTO categories (parent_id, name, sort) VALUES (?, ?, ?)",
    Number(parent.id),
    childName,
    Number(maxSort.n) + 1,
  );
}

function ensureInvoiceCommitment(db: DB, key: string, name: string, category: number, sort: number) {
  const existing = db.prepare("SELECT id FROM commitments WHERE key = ?").get(key) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      "UPDATE commitments SET invoice_detail = 1, counts_in_total = 0, active = 1, notes = ? WHERE key = ?",
    ).run(INVOICE_NOTE, key);
    return;
  }
  insertId(
    db,
    `INSERT INTO commitments
      (key, name, category_id, kind, counts_in_total, invoice_detail, active, notes, sort)
     VALUES (?, ?, ?, 'variable_monthly', 0, 1, 1, ?, ?)`,
    key,
    name,
    category,
    INVOICE_NOTE,
    sort,
  );
}

function placeMicrosoft(db: DB) {
  const done = db.prepare("SELECT value FROM meta WHERE key = 'microsoft_empresa'").get() as { value: string } | undefined;
  if (done) return;
  const category = categoryId(db, "Empresa", "Microsoft");
  db.prepare("UPDATE commitments SET category_id = ? WHERE name = 'Microsoft'").run(category);
  db.prepare(
    `UPDATE entries SET category_id = ?
     WHERE commitment_id IN (SELECT id FROM commitments WHERE name = 'Microsoft')
       AND month_id IN (SELECT id FROM months WHERE year > 2026 OR (year = 2026 AND month >= 10))`,
  ).run(category);
  db.prepare(
    `DELETE FROM categories
     WHERE id NOT IN (SELECT category_id FROM commitments)
       AND id NOT IN (SELECT category_id FROM entries WHERE category_id IS NOT NULL)
       AND parent_id = (SELECT id FROM categories WHERE name = 'Streaming' AND parent_id IS NULL)
       AND name IN ('Netflix', 'Apple', 'Microsoft')`,
  ).run();
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('microsoft_empresa', '1')").run();
}

function placeMeli(db: DB) {
  const done = db.prepare("SELECT value FROM meta WHERE key = 'meli_streaming'").get() as { value: string } | undefined;
  if (done) return;
  const category = categoryId(db, "Streaming", "Meli+");
  db.prepare("UPDATE commitments SET category_id = ? WHERE name = 'Meli+'").run(category);
  db.prepare(
    `UPDATE entries SET category_id = ?
     WHERE commitment_id IN (SELECT id FROM commitments WHERE name = 'Meli+')
       AND month_id IN (SELECT id FROM months WHERE year > 2026 OR (year = 2026 AND month >= 10))`,
  ).run(category);
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('meli_streaming', '1')").run();
}

function carrySofia(db: DB) {
  const done = db.prepare("SELECT value FROM meta WHERE key = 'sofia_carried'").get() as { value: string } | undefined;
  if (done) return;
  db.prepare("UPDATE commitments SET kind = 'carried_monthly' WHERE key = 'sofia'").run();
  db.prepare("INSERT INTO meta (key, value) VALUES ('sofia_carried', '1')").run();
}

function fillFixedAmounts(db: DB) {
  const done = db.prepare("SELECT value FROM meta WHERE key = 'fill_fixed_2026_10'").get() as { value: string } | undefined;
  if (done) return;
  db.prepare(
    `UPDATE entries
     SET amount_cents = (
       SELECT c.amount_cents FROM commitments c
       WHERE c.id = entries.commitment_id
         AND c.kind != 'variable_monthly'
         AND c.kind != 'carried_monthly'
         AND c.amount_cents IS NOT NULL
     )
     WHERE amount_cents IS NULL
       AND commitment_id IS NOT NULL
       AND month_id IN (SELECT id FROM months WHERE year > 2026 OR (year = 2026 AND month >= 10))
       AND EXISTS (
         SELECT 1 FROM commitments c
         WHERE c.id = entries.commitment_id
           AND c.kind != 'variable_monthly'
           AND c.kind != 'carried_monthly'
           AND c.amount_cents IS NOT NULL
       )`,
  ).run();
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('fill_fixed_2026_10', '1')").run();
}

function forgetUnlinked(db: DB) {
  const done = db.prepare("SELECT value FROM meta WHERE key = 'unlinked_from_2026_10'").get() as { value: string } | undefined;
  if (done) return;
  db.prepare(
    `DELETE FROM entries
     WHERE commitment_id IS NULL
       AND manual = 0
       AND month_id IN (SELECT id FROM months WHERE year > 2026 OR (year = 2026 AND month >= 10))`,
  ).run();
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('unlinked_from_2026_10', '1')").run();
}

function monthId(db: DB, year: number, month: number): number | undefined {
  const row = db.prepare("SELECT id FROM months WHERE year = ? AND month = ?").get(year, month) as { id: number } | undefined;
  return row ? Number(row.id) : undefined;
}

export function prepareLedger(db: DB) {
  ensureColumn(db, "commitments", "invoice_detail", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "entries", "invoice_detail", "INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)");
  forgetUnlinked(db);
  placeMicrosoft(db);
  placeMeli(db);
  carrySofia(db);
  fillFixedAmounts(db);
  const done = db.prepare("SELECT value FROM meta WHERE key = 'living_2026_11'").get() as { value: string } | undefined;
  if (done) return;
  db.exec("BEGIN IMMEDIATE");
  try {
  const again = db.prepare("SELECT value FROM meta WHERE key = 'living_2026_11'").get() as { value: string } | undefined;
  if (again) {
    db.exec("COMMIT");
    return;
  }

  const youtube = categoryId(db, "Streaming", "YouTube");
  const google = categoryId(db, "Streaming", "Google");
  const microsoft = categoryId(db, "Streaming", "Microsoft");
  ensureInvoiceCommitment(db, "youtube", "YouTube", youtube, 281);
  ensureInvoiceCommitment(db, "google", "Google", google, 282);
  ensureInvoiceCommitment(db, "microsoft", "Microsoft", microsoft, 283);
  db.prepare(
    `UPDATE commitments SET invoice_detail = 1, counts_in_total = 0 WHERE key IN ('netflix', 'prime', 'apple', 'hostinger')`,
  ).run();

  const keys = db.prepare(
    `SELECT id FROM commitments WHERE key IN (${INVOICE_KEYS.map(() => "?").join(", ")})`,
  ).all(...INVOICE_KEYS) as { id: number }[];
  const ids = keys.map((row) => Number(row.id));
  if (ids.length > 0) {
    db.prepare(
      `UPDATE entries SET invoice_detail = 1, counts_in_total = 0
       WHERE commitment_id IN (${ids.map(() => "?").join(", ")})
         AND month_id IN (SELECT id FROM months WHERE year > 2026 OR (year = 2026 AND month >= 10))`,
    ).run(...ids);
  }

  db.prepare(
    `DELETE FROM entries
     WHERE manual = 0
       AND month_id IN (SELECT id FROM months WHERE year = 2026 AND month >= 11)`,
  ).run();

  for (const month of [10, 11, 12]) {
    const id = monthId(db, 2026, month);
    if (id) ensureEntries(db, id, 2026, month);
  }

  db.prepare("INSERT INTO meta (key, value) VALUES ('living_2026_11', '1')").run();
  db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
