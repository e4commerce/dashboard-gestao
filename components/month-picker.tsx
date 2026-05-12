"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_PT[m - 1]} ${y}`;
}

type Props = {
  month: string;
};

export function MonthPicker({ month }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(newMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-surface-card px-1 py-1">
      <button
        type="button"
        onClick={() => navigate(addMonths(month, -1))}
        aria-label="Mês anterior"
        className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-input hover:text-fg-primary"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[128px] select-none text-center text-sm font-medium text-fg-primary">
        {formatLabel(month)}
      </span>
      <button
        type="button"
        onClick={() => navigate(addMonths(month, 1))}
        aria-label="Próximo mês"
        className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-input hover:text-fg-primary"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
