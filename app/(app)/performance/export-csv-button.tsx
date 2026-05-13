"use client";

import { Download } from "lucide-react";
import type {
  DailyPerformancePoint,
  PerformanceTotals,
} from "@/server/queries/performance";

type Props = {
  month: string;
  daily: DailyPerformancePoint[];
  totals: PerformanceTotals;
};

const HEADERS = [
  "Data",
  "Sessões",
  "Pedidos",
  "Meta Pedidos",
  "Faturamento",
  "Meta Faturamento",
  "Conversão %",
  "ROAS",
  "Ticket Médio",
  "Marketing",
  "CPS",
  "Lucro Bruto",
  "Meta Lucro Bruto",
  "Margem Bruta %",
  "Meta Margem %",
  "CPA",
];

function brNumber(value: number | null, digits = 2): string {
  if (value === null) return "";
  return value.toFixed(digits).replace(".", ",");
}

function buildRow(p: DailyPerformancePoint): string {
  return [
    p.date,
    brNumber(p.sessoesReal, 0),
    brNumber(p.pedidosReal, 0),
    brNumber(p.pedidosPrev, 0),
    brNumber(p.faturamentoReal),
    brNumber(p.faturamentoPrev),
    brNumber(p.conversaoReal, 2),
    brNumber(p.roasReal, 2),
    brNumber(p.ticketReal, 2),
    brNumber(p.marketingReal),
    brNumber(p.cpsReal, 2),
    brNumber(p.lucroBrutoReal),
    brNumber(p.lucroBrutoPrev),
    brNumber(p.margemBrutaReal, 2),
    brNumber(p.margemBrutaPrev, 2),
    brNumber(p.cpaReal, 2),
  ].join(";");
}

function buildTotalRow(t: PerformanceTotals): string {
  return [
    "Total",
    brNumber(t.sessoesReal, 0),
    brNumber(t.pedidosReal, 0),
    brNumber(t.pedidosPrev, 0),
    brNumber(t.faturamentoReal),
    brNumber(t.faturamentoPrev),
    brNumber(t.conversaoReal, 2),
    brNumber(t.roasReal, 2),
    brNumber(t.ticketReal, 2),
    brNumber(t.marketingReal),
    brNumber(t.cpsReal, 2),
    brNumber(t.lucroBrutoReal),
    brNumber(t.lucroBrutoPrev),
    brNumber(t.margemBrutaReal, 2),
    brNumber(t.margemBrutaPrev, 2),
    brNumber(t.cpaReal, 2),
  ].join(";");
}

export function ExportCsvButton({ month, daily, totals }: Props) {
  const handleClick = () => {
    const lines = [
      HEADERS.join(";"),
      ...daily.map(buildRow),
      buildTotalRow(totals),
    ];
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={daily.length === 0}
      className="flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3 py-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface-card-hover hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="size-3.5" strokeWidth={2.25} />
      Exportar CSV
    </button>
  );
}
