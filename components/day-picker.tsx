"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

type Props = {
  day: string;
  paramName?: string;
  ariaLabelPrev?: string;
  ariaLabelNext?: string;
};

export function DayPicker({
  day,
  paramName = "day",
  ariaLabelPrev = "Dia anterior",
  ariaLabelNext = "Próximo dia",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(newDay: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, newDay);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-surface-card px-1 py-1">
      <button
        type="button"
        onClick={() => navigate(addDays(day, -1))}
        aria-label={ariaLabelPrev}
        className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-input hover:text-fg-primary"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[96px] select-none text-center text-sm font-medium text-fg-primary tabular-nums">
        {formatLabel(day)}
      </span>
      <button
        type="button"
        onClick={() => navigate(addDays(day, 1))}
        aria-label={ariaLabelNext}
        className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-input hover:text-fg-primary"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
