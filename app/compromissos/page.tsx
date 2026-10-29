import type { Metadata } from "next";
import { addCategory } from "@/app/actions";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { CommitmentForm } from "@/components/CommitmentForm";
import { DeleteCommitment } from "@/components/DeleteCommitment";
import { getDb } from "@/lib/db";
import { categoryChoices, listCommitments } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { KINDS, type CommitmentView } from "@/lib/types";

export const metadata: Metadata = { title: "Compromissos" };
export const dynamic = "force-dynamic";

function kindLabel(kind: CommitmentView["kind"]): string {
  return KINDS.find((item) => item.id === kind)?.label ?? kind;
}

function groupTotal(items: CommitmentView[]): string {
  const count = items.length === 1 ? "1 conta" : `${items.length} contas`;
  const known = items.filter((item) => item.amountCents != null);
  if (known.length === 0) return count;
  const sum = known.reduce((acc, item) => acc + (item.amountCents ?? 0), 0);
  return `${formatMoney(sum)} · ${count}`;
}

export default async function CommitmentsPage() {
  const db = await getDb();
  const commitments = listCommitments(db);
  const categories = categoryChoices(db);
  const roots = [...new Set(commitments.map((item) => item.root))].sort((a, b) => {
    const left = commitments.find((item) => item.root === a)?.rootSort ?? 0;
    const right = commitments.find((item) => item.root === b)?.rootSort ?? 0;
    return left - right;
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Compromissos</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Cada conta existe uma vez. O mês seguinte nasce daqui. Desativar ou apagar tira a conta deste mês em diante. Os meses anteriores ficam no histórico.
        </p>
      </div>
      <CollapsibleSection title="Nova categoria">
        <form action={addCategory} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm">
            <span className="text-muted">Nome</span>
            <input name="name" required className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Dentro de</span>
            <select name="parentId" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2">
              <option value="">Nenhuma, é uma categoria principal</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-white">
            Criar categoria
          </button>
        </form>
      </CollapsibleSection>
      <CollapsibleSection title="Novo compromisso">
        <div className="p-4">
          <CommitmentForm categories={categories} />
        </div>
      </CollapsibleSection>
      {roots.map((root) => {
        const items = commitments.filter((item) => item.root === root);
        return (
          <CollapsibleSection key={root} title={root} total={groupTotal(items)} contained={false}>
            {root === "Parcelamentos antigos" ? (
              <p className="text-sm text-muted">
                Vieram da aba Parcelamentos e não entram na soma. Desative o que não fizer mais sentido.
              </p>
            ) : null}
            {items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-muted">
                      {item.categoryPath} · {kindLabel(item.kind)}
                      {item.amountCents != null ? ` · ${formatMoney(item.amountCents)}` : ""}
                      {item.invoiceDetail ? " · dentro da fatura" : item.countsInTotal ? " · entra na soma" : " · fora da soma"}
                      {item.active ? "" : " · inativo"}
                    </p>
                    <p className="mt-1 text-sm text-muted">{item.hint}</p>
                  </div>
                  <DeleteCommitment id={item.id} name={item.name} />
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-moss">Editar</summary>
                  <div className="mt-3">
                    <CommitmentForm categories={categories} commitment={item} />
                  </div>
                </details>
              </article>
            ))}
          </CollapsibleSection>
        );
      })}
    </div>
  );
}
