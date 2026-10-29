import type { ReactNode } from "react";

export function CollapsibleSection({
  title,
  total,
  children,
  contained = true,
}: {
  title: string;
  total?: string;
  children: ReactNode;
  contained?: boolean;
}) {
  return (
    <details className={contained ? "fold overflow-hidden rounded-2xl border border-line bg-card" : "fold"}>
      <summary
        className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-3 ${contained ? "" : "rounded-2xl border border-line bg-card"}`}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="chevron text-sm text-muted" aria-hidden="true">
            ▸
          </span>
          <h2 className="font-serif text-xl">{title}</h2>
        </span>
        {total ? <p className="shrink-0 text-right tabular-nums text-muted">{total}</p> : null}
      </summary>
      {contained ? children : <div className="mt-3 grid gap-3">{children}</div>}
    </details>
  );
}
