import path from "path";
import { insertId, type DB } from "./sql";
import { MONTHS } from "./dates";
import { toCents } from "./format";

type Node = { name: string; children?: Node[] };

const TREE: Node[] = [
  {
    name: "Colégio",
    children: [{ name: "Mensalidade" }, { name: "Materiais" }, { name: "Rematrícula" }],
  },
  {
    name: "Veículo",
    children: [{ name: "Parcelamento" }, { name: "Manutenção" }],
  },
  { name: "Energia", children: [{ name: "Enel" }] },
  { name: "MEI", children: [{ name: "DAS" }, { name: "Parcelamento" }] },
  { name: "Empresa", children: [{ name: "VPS Hostinger" }, { name: "Registro BR" }] },
  {
    name: "Cartões",
    children: [
      { name: "Faturas", children: [{ name: "Nu PJ" }, { name: "Nu PF" }, { name: "MP PF" }] },
      {
        name: "Parcelamentos",
        children: [{ name: "Nu PJ" }, { name: "Nu PF" }, { name: "MP PF" }],
      },
    ],
  },
  { name: "Celular", children: [{ name: "Vivo" }, { name: "NuCel" }] },
  { name: "Internet", children: [{ name: "Vivo" }] },
  { name: "Streaming", children: [{ name: "Netflix" }, { name: "Prime" }, { name: "Apple" }] },
  { name: "Mesada", children: [{ name: "Sofia" }] },
  { name: "Outros", children: [{ name: "Carrefour" }] },
  { name: "Parcelamentos antigos" },
];

const FORA =
  "Fora da soma para não contar duas vezes. Inclua na soma se este pagamento sai separado da fatura.";

type Seed = {
  key: string;
  name: string;
  path: string;
  kind: string;
  amount?: number;
  counts: boolean;
  sort: number;
  aliases: string[];
  notes?: string;
};

const PRIMARY: Seed[] = [
  { key: "sofia", name: "Sofia", path: "Mesada/Sofia", kind: "carried_monthly", amount: 180, counts: true, sort: 10, aliases: ["sofia"], notes: "Na planilha de 2026 a mesada prevista era R$ 180. Os meses já lançados mantêm o valor da aba. O valor de um mês passa para os seguintes que ainda estavam com o valor anterior, ou vazios." },
  { key: "cne", name: "CNE", path: "Colégio/Mensalidade", kind: "fixed_monthly", amount: 1242.35, counts: true, sort: 20, aliases: ["cne"] },
  { key: "livina", name: "Livina", path: "Veículo/Parcelamento", kind: "fixed_monthly", amount: 1072.84, counts: true, sort: 30, aliases: ["livina"] },
  { key: "enel", name: "Enel", path: "Energia/Enel", kind: "variable_monthly", counts: true, sort: 40, aliases: ["energia", "enel"] },
  { key: "internet", name: "Internet", path: "Internet/Vivo", kind: "variable_monthly", counts: true, sort: 50, aliases: ["internet", "vivo internet"] },
  { key: "celular", name: "Celular", path: "Celular/Vivo", kind: "variable_monthly", counts: true, sort: 60, aliases: ["celular", "vivo"] },
  { key: "nu-pf-emprestimo", name: "Nu PF Empréstimo", path: "Cartões/Parcelamentos/Nu PF", kind: "variable_monthly", counts: true, sort: 70, aliases: ["nu pf emprestimo", "nu pf emprestimo"], notes: "O valor de cada mês é o que estava lançado na aba, não o da matriz de parcelamentos." },
  { key: "carrefour", name: "Carrefour", path: "Outros/Carrefour", kind: "variable_monthly", counts: true, sort: 80, aliases: ["carrefour"] },
  { key: "mp-pf", name: "MP PF", path: "Cartões/Faturas/MP PF", kind: "variable_monthly", counts: true, sort: 90, aliases: ["mp credito", "mp credito", "mp pf"] },
  { key: "mp-emprestimo", name: "MP Empréstimo", path: "Cartões/Parcelamentos/MP PF", kind: "variable_monthly", counts: true, sort: 100, aliases: ["mp emprestimo", "mp emprestimo"] },
  { key: "nu-pj", name: "Nu PJ", path: "Cartões/Faturas/Nu PJ", kind: "variable_monthly", counts: true, sort: 110, aliases: ["nu pj"] },
  { key: "nu-pf", name: "Nu PF", path: "Cartões/Faturas/Nu PF", kind: "variable_monthly", counts: true, sort: 120, aliases: ["nu pf"] },
  { key: "das", name: "DAS", path: "MEI/DAS", kind: "variable_monthly", counts: true, sort: 130, aliases: ["mei", "das"] },
  { key: "nu-pj-giro", name: "Nu PJ Giro", path: "Cartões/Parcelamentos/Nu PJ", kind: "variable_monthly", counts: true, sort: 140, aliases: ["nu pj giro"] },
  { key: "materiais", name: "Materiais", path: "Colégio/Materiais", kind: "annual", counts: false, sort: 200, aliases: ["materiais"], notes: "Informe o mês do ano para a conta aparecer no mês certo. " + FORA },
  { key: "rematricula", name: "Rematrícula", path: "Colégio/Rematrícula", kind: "annual", counts: false, sort: 210, aliases: ["rematricula"], notes: "Informe o mês do ano para a conta aparecer no mês certo. " + FORA },
  { key: "mei-parcelamento", name: "Parcelamento do MEI", path: "MEI/Parcelamento", kind: "installment", counts: false, sort: 220, aliases: [], notes: "Informe o início, a quantidade e o valor da parcela para ela entrar no mês. " + FORA },
  { key: "hostinger", name: "VPS Hostinger", path: "Empresa/VPS Hostinger", kind: "variable_monthly", counts: false, sort: 230, aliases: ["hostinger", "vps hostinger"], notes: FORA },
  { key: "registro-br", name: "Registro BR", path: "Empresa/Registro BR", kind: "annual", counts: false, sort: 240, aliases: ["registro br", "registro.br"], notes: "Informe o mês do ano para a conta aparecer no mês certo. " + FORA },
  { key: "nucel", name: "NuCel", path: "Celular/NuCel", kind: "variable_monthly", counts: false, sort: 250, aliases: ["nucel"], notes: FORA },
  { key: "netflix", name: "Netflix", path: "Streaming/Netflix", kind: "variable_monthly", counts: false, sort: 260, aliases: ["netflix"], notes: FORA },
  { key: "prime", name: "Prime", path: "Streaming/Prime", kind: "variable_monthly", counts: false, sort: 270, aliases: ["prime", "amazon prime"], notes: FORA },
  { key: "apple", name: "Apple", path: "Streaming/Apple", kind: "variable_monthly", counts: false, sort: 280, aliases: ["apple"], notes: FORA },
];

const MATRIX_SKIP = new Set(["mp emprestimo", "nu pf emprestimo"]);

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string): string {
  return norm(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unwrap(value: unknown): unknown {
  if (value && typeof value === "object") {
    if ("result" in value) {
      const result = (value as { result: unknown }).result;
      if (result && typeof result === "object" && "error" in result) return null;
      return unwrap(result);
    }
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join("");
    }
    if ("text" in value && "hyperlink" in value) {
      return (value as { text: string }).text;
    }
  }
  return value;
}

function cellText(value: unknown): string {
  const raw = unwrap(value);
  return typeof raw === "string" ? raw.trim() : "";
}

function isPaid(value: unknown): boolean {
  const raw = unwrap(value);
  return raw === true || raw === 1 || raw === "1";
}

function insertTree(
  db: DB,
  nodes: Node[],
  parentId: number | null,
  counter: { n: number },
  paths: Map<string, number>,
  prefix: string,
) {
  for (const node of nodes) {
    const id = insertId(
      db,
      "INSERT INTO categories (parent_id, name, sort) VALUES (?, ?, ?)",
      parentId,
      node.name,
      counter.n++,
    );
    const pathName = prefix ? `${prefix}/${node.name}` : node.name;
    paths.set(pathName, id);
    if (node.children?.length) insertTree(db, node.children, id, counter, paths, pathName);
  }
}

function columnToYearMonth(column: number): { year: number; month: number } {
  const absolute = 2025 * 12 + 11 + (column - 2);
  const year = Math.floor(absolute / 12);
  const month = absolute - year * 12 + 1;
  return { year, month };
}

function readIncome(value: unknown): { base: number; extra: number } {
  if (value && typeof value === "object" && "formula" in value) {
    const formula = String((value as { formula: unknown }).formula);
    const match = formula.match(/^\s*(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*$/);
    if (match) {
      return {
        base: Math.round(Number(match[1]) * 100),
        extra: Math.round(Number(match[2]) * 100),
      };
    }
  }
  return { base: toCents(unwrap(value)) ?? 0, extra: 0 };
}

export async function importWorkbook(db: DB): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const file = path.join(process.cwd(), "MVTCorp.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const findSheet = (name: string) =>
    workbook.worksheets.find((sheet) => norm(sheet.name) === norm(name));

  db.exec("BEGIN IMMEDIATE");
  try {
    const paths = new Map<string, number>();
    insertTree(db, TREE, null, { n: 0 }, paths, "");
    const outrosId = paths.get("Outros");
    const antigosId = paths.get("Parcelamentos antigos");
    if (!outrosId || !antigosId) throw new Error("Categorias base não foram criadas");

    const aliasToKey = new Map<string, string>();
    for (const item of PRIMARY) {
      for (const alias of item.aliases) aliasToKey.set(norm(alias), item.key);
      const categoryId = paths.get(item.path);
      if (!categoryId) throw new Error(`Categoria não encontrada: ${item.path}`);
      insertId(
        db,
        `INSERT INTO commitments
          (key, name, category_id, kind, amount_cents, counts_in_total, active, notes, sort)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        item.key,
        item.name,
        categoryId,
        item.kind,
        item.amount == null ? null : Math.round(item.amount * 100),
        item.counts ? 1 : 0,
        item.notes ?? null,
        item.sort,
      );
    }

    const commitmentByKey = new Map<string, { id: number; name: string; categoryId: number }>();
    const commitmentRows = db.prepare("SELECT id, key, name, category_id FROM commitments").all() as {
      id: number;
      key: string;
      name: string;
      category_id: number;
    }[];
    for (const row of commitmentRows) {
      commitmentByKey.set(row.key, {
        id: Number(row.id),
        name: row.name,
        categoryId: Number(row.category_id),
      });
    }

    for (let index = 0; index < MONTHS.length; index += 1) {
      const sheet = findSheet(MONTHS[index]);
      if (!sheet) throw new Error(`Aba ${MONTHS[index]} não encontrada`);
      const income = readIncome(sheet.getRow(2).getCell(1).value);
      const monthId = insertId(
        db,
        "INSERT INTO months (year, month, income_base_cents, income_extra_cents) VALUES (2026, ?, ?, ?)",
        index + 1,
        income.base,
        income.extra,
      );
      const last = Math.min(sheet.rowCount, 80);
      for (let rowNumber = 3; rowNumber <= last; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const sheetName = cellText(row.getCell(1).value);
        if (!sheetName || norm(sheetName) === "total") continue;
        const amount = toCents(unwrap(row.getCell(2).value));
        const paid = isPaid(row.getCell(4).value);
        const alias = aliasToKey.get(norm(sheetName));
        let linked = alias ? commitmentByKey.get(alias) : undefined;
        if (!linked) {
          const key = `hist:${slug(sheetName)}`;
          linked = commitmentByKey.get(key);
          if (!linked) {
            const id = insertId(
              db,
              `INSERT INTO commitments
                (key, name, category_id, kind, counts_in_total, active, sort, notes)
               VALUES (?, ?, ?, 'variable_monthly', 1, 0, ?, ?)`,
              key,
              sheetName,
              outrosId,
              500 + commitmentByKey.size,
              "Linha antiga da planilha. Inativa para não voltar nos próximos meses.",
            );
            linked = { id, name: sheetName, categoryId: outrosId };
            commitmentByKey.set(key, linked);
          }
        }
        insertId(
          db,
          `INSERT INTO entries
            (month_id, commitment_id, name, category_id, amount_cents, paid, counts_in_total, manual, sort)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)`,
          monthId,
          linked.id,
          linked.name,
          linked.categoryId,
          amount,
          paid ? 1 : 0,
          rowNumber,
        );
      }
    }

    const matrix = findSheet("Parcelamentos");
    if (!matrix) throw new Error("Aba Parcelamentos não encontrada");
    const usedNames = new Set<string>();
    const lastMatrixRow = Math.min(matrix.rowCount, 80);
    for (let rowNumber = 3; rowNumber <= lastMatrixRow; rowNumber += 1) {
      const row = matrix.getRow(rowNumber);
      const sheetName = cellText(row.getCell(1).value);
      if (!sheetName || norm(sheetName) === "total") continue;
      if (MATRIX_SKIP.has(norm(sheetName))) continue;
      const filled: { column: number; cents: number }[] = [];
      for (let column = 2; column <= 14; column += 1) {
        const cents = toCents(unwrap(row.getCell(column).value));
        if (cents != null) filled.push({ column, cents });
      }
      if (filled.length === 0) continue;
      const first = columnToYearMonth(filled[0].column);
      const last = columnToYearMonth(filled[filled.length - 1].column);
      const span = last.year * 12 + last.month - (first.year * 12 + first.month) + 1;
      const named = sheetName.match(/(\d+)\s*x/i);
      const count = Math.max(span, named ? Number(named[1]) : span);
      const amount = filled[filled.length - 1].cents;
      let name = aliasToKey.has(norm(sheetName)) ? `${sheetName} (parcelamento antigo)` : sheetName;
      let copy = 2;
      while (usedNames.has(norm(name))) {
        name = `${sheetName} (${copy})`;
        copy += 1;
      }
      usedNames.add(norm(name));
      const key = `matriz:${slug(name)}`;
      insertId(
        db,
        `INSERT INTO commitments
          (key, name, category_id, kind, amount_cents, installment_count, installment_start, counts_in_total, active, notes, sort)
         VALUES (?, ?, ?, 'installment', ?, ?, ?, 0, 1, ?, ?)`,
        key,
        name,
        antigosId,
        amount,
        count,
        `${first.year}-${String(first.month).padStart(2, "0")}`,
        FORA,
        800 + rowNumber,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
