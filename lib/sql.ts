import type { DatabaseSync } from "node:sqlite";

export type DB = DatabaseSync;

export function insertId(db: DB, sql: string, ...params: (string | number | null)[]): number {
  const result = db.prepare(sql).run(...params);
  return Number(result.lastInsertRowid);
}

export function num(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : Number(value);
}

export function bool(value: unknown): boolean {
  return value === 1 || value === true;
}
