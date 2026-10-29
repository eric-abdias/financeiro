"use client";

import { useTransition } from "react";
import { deleteCommitment } from "@/app/actions";

export function DeleteCommitment({ id, name }: { id: number; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-muted underline-offset-2 hover:underline"
      onClick={() => {
        if (confirm(`Apagar ${name}? Sai deste mês em diante. Os meses anteriores ficam no histórico.`)) {
          startTransition(() => deleteCommitment(id));
        }
      }}
    >
      Apagar
    </button>
  );
}
