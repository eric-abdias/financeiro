"use client";

import { useState } from "react";
import { saveCommitment } from "@/app/actions";
import { MONTHS } from "@/lib/dates";
import { centsToInput } from "@/lib/format";
import { KINDS, type CategoryOption, type CommitmentView, type Kind } from "@/lib/types";

const field = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";

export function CommitmentForm({
  categories,
  commitment,
}: {
  categories: CategoryOption[];
  commitment?: CommitmentView;
}) {
  const [kind, setKind] = useState<Kind>(commitment?.kind ?? "variable_monthly");
  const editing = Boolean(commitment);

  return (
    <form action={saveCommitment} className="grid gap-3">
      {commitment ? <input type="hidden" name="id" value={commitment.id} /> : null}
      <label className="block text-sm">
        <span className="text-muted">Nome</span>
        <input name="name" required defaultValue={commitment?.name ?? ""} className={field} />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Categoria</span>
        <select name="categoryId" defaultValue={commitment?.categoryId ?? categories[0]?.id} className={field}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted">Tipo</span>
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as Kind)}
          className={field}
        >
          {KINDS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted">Valor</span>
        <input
          name="amount"
          inputMode="decimal"
          placeholder={kind === "variable_monthly" ? "preenchido no mês" : "0,00"}
          defaultValue={commitment?.amountCents == null ? "" : centsToInput(commitment.amountCents)}
          className={field}
        />
        {kind === "carried_monthly" ? (
          <span className="mt-1 block text-muted">
            O valor se altera no mês. Os seguintes que ainda estavam com esse valor, ou vazios, acompanham. Zero também segue.
          </span>
        ) : null}
      </label>
      {kind === "annual" ? (
        <label className="block text-sm">
          <span className="text-muted">Mês do ano</span>
          <select name="dueMonth" defaultValue={commitment?.dueMonth ?? ""} className={field}>
            <option value="">Escolher</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="dueMonth" value="" />
      )}
      {kind === "installment" || kind === "once" ? (
        <label className="block text-sm">
          <span className="text-muted">{kind === "once" ? "Mês" : "Primeira parcela"}</span>
          <input
            type="month"
            name="installmentStart"
            defaultValue={commitment?.installmentStart ?? ""}
            className={field}
          />
        </label>
      ) : (
        <input type="hidden" name="installmentStart" value="" />
      )}
      {kind === "installment" ? (
        <label className="block text-sm">
          <span className="text-muted">Quantidade de parcelas</span>
          <input
            name="installmentCount"
            inputMode="numeric"
            defaultValue={commitment?.installmentCount ?? ""}
            className={field}
          />
        </label>
      ) : (
        <input type="hidden" name="installmentCount" value="" />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">No mês</span>
          <select
            name="place"
            defaultValue={commitment?.invoiceDetail ? "fatura" : commitment && !commitment.countsInTotal ? "fora" : "soma"}
            className={field}
          >
            <option value="soma">Entra na soma</option>
            <option value="fatura">Dentro da fatura</option>
            <option value="fora">Fora da soma</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted">Ativo</span>
          <select name="active" defaultValue={commitment ? (commitment.active ? "1" : "0") : "1"} className={field}>
            <option value="1">Sim</option>
            <option value="0">Não</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted">Observação</span>
        <textarea name="notes" rows={2} defaultValue={commitment?.notes ?? ""} className={field} />
      </label>
      <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-white">
        {editing ? "Salvar" : "Adicionar"}
      </button>
    </form>
  );
}
