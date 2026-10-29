import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { importWorkbook } from "./import-xlsx";
import { prepareLedger } from "./ledger";
import type { DB } from "./sql";

export type { DB } from "./sql";

const globalForDb = globalThis as unknown as { financeiro?: Promise<DB> };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER REFERENCES categories(id),
  name TEXT NOT NULL,
  sort INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commitments (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  kind TEXT NOT NULL,
  amount_cents INTEGER,
  due_month INTEGER,
  installment_count INTEGER,
  installment_start TEXT,
  counts_in_total INTEGER NOT NULL DEFAULT 1,
  invoice_detail INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS months (
  id INTEGER PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  income_base_cents INTEGER NOT NULL DEFAULT 0,
  income_extra_cents INTEGER NOT NULL DEFAULT 0,
  UNIQUE (year, month)
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  month_id INTEGER NOT NULL REFERENCES months(id),
  commitment_id INTEGER REFERENCES commitments(id),
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  amount_cents INTEGER,
  paid INTEGER NOT NULL DEFAULT 0,
  counts_in_total INTEGER NOT NULL DEFAULT 1,
  invoice_detail INTEGER NOT NULL DEFAULT 0,
  manual INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_month ON entries(month_id);
CREATE INDEX IF NOT EXISTS idx_entries_commitment ON entries(commitment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_month_commitment
  ON entries(month_id, commitment_id)
  WHERE commitment_id IS NOT NULL;
`;

function openDatabase(): DB {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "financeiro.db"));
  db.exec("PRAGMA foreign_keys = ON");
  db.prepare("PRAGMA journal_mode = WAL").get();
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}

async function open(): Promise<DB> {
  const db = openDatabase();
  const row = db.prepare("SELECT COUNT(*) AS n FROM commitments").get() as { n: number };
  if (Number(row.n) === 0) {
    await importWorkbook(db);
  }
  return db;
}

export async function getDb(): Promise<DB> {
  if (!globalForDb.financeiro) {
    globalForDb.financeiro = open().catch((error) => {
      globalForDb.financeiro = undefined;
      throw error;
    });
  }
  const db = await globalForDb.financeiro;
  prepareLedger(db);
  return db;
}

