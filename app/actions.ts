"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE, authConfigured, verifySession } from "@/lib/session";
import {
  addManualEntry,
  createCategory,
  ensureCurrentMonth,
  resyncCommitment,
  saveEntryAmount,
  saveIncome,
} from "@/lib/finance";
import { parseMoney } from "@/lib/format";
import type { Kind } from "@/lib/types";
import { KINDS } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

async function assertSession() {
  if (!authConfigured()) redirect("/login?setup=1");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySession(token, process.env.AUTH_SECRET ?? ""))) redirect("/login");
}

export async function setEntryPaid(entryId: number, paid: boolean) {
  await assertSession();
  const db = await getDb();
  db.prepare("UPDATE entries SET paid = ? WHERE id = ?").run(paid ? 1 : 0, entryId);
  refresh();
}

export async function setEntryAmount(entryId: number, amountCents: number | null) {
  await assertSession();
  const db = await getDb();
  saveEntryAmount(db, entryId, amountCents);
  refresh();
}

export async function setEntryCounts(entryId: number, counts: boolean) {
  await assertSession();
  const db = await getDb();
  const entry = db.prepare("SELECT id, commitment_id FROM entries WHERE id = ?").get(entryId) as
    | { id: number; commitment_id: number | null }
    | undefined;
  if (!entry) return;
  db.prepare("UPDATE entries SET counts_in_total = ?, invoice_detail = 0 WHERE id = ?").run(counts ? 1 : 0, entryId);
  if (entry.commitment_id != null) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    db.prepare("UPDATE commitments SET counts_in_total = ?, invoice_detail = 0 WHERE id = ?").run(counts ? 1 : 0, Number(entry.commitment_id));
    db.prepare(
      `UPDATE entries SET counts_in_total = ?, invoice_detail = 0
       WHERE commitment_id = ?
         AND month_id IN (SELECT id FROM months WHERE year > ? OR (year = ? AND month >= ?))`,
    ).run(counts ? 1 : 0, Number(entry.commitment_id), year, year, month);
  }
  refresh();
}

export async function setIncome(year: number, month: number, baseCents: number, extraCents: number) {
  await assertSession();
  const db = await getDb();
  saveIncome(db, year, month, baseCents, extraCents);
  refresh();
}

export async function deleteEntry(entryId: number) {
  await assertSession();
  const db = await getDb();
  const entry = db.prepare("SELECT manual FROM entries WHERE id = ?").get(entryId) as { manual: number } | undefined;
  if (!entry || Number(entry.manual) !== 1) return;
  db.prepare("DELETE FROM entries WHERE id = ?").run(entryId);
  refresh();
}

export async function addAvulso(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const categoryId = Number(formData.get("categoryId"));
  const amountRaw = String(formData.get("amount") || "");
  const amountCents = amountRaw.trim() ? parseMoney(amountRaw) : null;
  if (amountRaw.trim() && amountCents == null) return;
  const place = String(formData.get("place") || "soma");
  await assertSession();
  const db = await getDb();
  addManualEntry(db, year, month, {
    name,
    categoryId,
    amountCents,
    countsInTotal: place === "soma",
    invoiceDetail: place === "fatura",
  });
  refresh();
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveCommitment(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const kind = String(formData.get("kind")) as Kind;
  if (!KINDS.some((item) => item.id === kind)) return;
  const categoryId = Number(formData.get("categoryId"));
  const amountRaw = String(formData.get("amount") || "");
  const amountCents = amountRaw.trim() ? parseMoney(amountRaw) : null;
  if (amountRaw.trim() && amountCents == null) return;
  const dueMonth = optionalNumber(formData.get("dueMonth"));
  const installmentCount = optionalNumber(formData.get("installmentCount"));
  const installmentStart = String(formData.get("installmentStart") || "").trim() || null;
  const place = String(formData.get("place") || "soma");
  const counts = place === "soma" ? 1 : 0;
  const invoice = place === "fatura" ? 1 : 0;
  const active = String(formData.get("active")) === "1" ? 1 : 0;
  const notes = String(formData.get("notes") || "").trim() || null;
  const id = Number(formData.get("id") || 0);
  await assertSession();
  const db = await getDb();
  const now = new Date();
  ensureCurrentMonth(db, now);

  let commitmentId = id;
  if (id) {
    db.prepare(
      `UPDATE commitments
       SET name = ?, category_id = ?, kind = ?, amount_cents = ?, due_month = ?, installment_count = ?, installment_start = ?, counts_in_total = ?, invoice_detail = ?, active = ?, notes = ?
       WHERE id = ?`,
    ).run(
      name,
      categoryId,
      kind,
      amountCents,
      dueMonth,
      installmentCount,
      installmentStart,
      counts,
      invoice,
      active,
      notes,
      id,
    );
  } else {
    const maxSort = db.prepare("SELECT COALESCE(MAX(sort), 0) AS n FROM commitments").get() as { n: number };
    commitmentId = Number(
      db.prepare(
        `INSERT INTO commitments
          (name, category_id, kind, amount_cents, due_month, installment_count, installment_start, counts_in_total, invoice_detail, active, notes, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        name,
        categoryId,
        kind,
        amountCents,
        dueMonth,
        installmentCount,
        installmentStart,
        counts,
        invoice,
        active,
        notes,
        Number(maxSort.n) + 10,
      ).lastInsertRowid,
    );
  }
  resyncCommitment(db, commitmentId, now);
  refresh();
}

export async function addCategory(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const parentRaw = String(formData.get("parentId") || "");
  const parentId = parentRaw ? Number(parentRaw) : null;
  await assertSession();
  const db = await getDb();
  createCategory(db, name, parentId);
  refresh();
}

export async function deleteCommitment(commitmentId: number) {
  await assertSession();
  const db = await getDb();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  db.prepare(
    `DELETE FROM entries
     WHERE commitment_id = ?
       AND month_id IN (SELECT id FROM months WHERE year > ? OR (year = ? AND month >= ?))`,
  ).run(commitmentId, year, year, month);
  db.prepare("UPDATE entries SET commitment_id = NULL WHERE commitment_id = ?").run(commitmentId);
  db.prepare("DELETE FROM commitments WHERE id = ?").run(commitmentId);
  refresh();
}
