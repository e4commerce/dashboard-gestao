"use client";

import { Download } from "lucide-react";
import type {
  DailyMarginPoint,
  MarginTotals,
} from "@/server/queries/margin";

type Props = {
  month: string;
  daily: DailyMarginPoint[];
  totals: MarginTotals;
};

const HEADERS = [
  "Data",
  "Faturamento",
  "Cobertura %",
  "Custo Produto",
  "Mídia",
  "Meta Ads",
  "Imposto Meta",
  "Google Ads",
  "Taxas",
  "Gateway",
  "Imposto",
  "Checkout",
  "Custo Operacional",
  "Reenvio",
  "Troca",
  "Voucher",
  "Zerado",
  "Lucro Performance",
  "Margem Performance %",
  "Lucro Operacional",
  "Margem Operacional %",
];

// Excel pt-BR: separador ; e vírgula decimal.
function brNumber(value: number, digits = 2): string {
  return value.toFixed(digits).replace(".", ",");
}

function buildRow(p: DailyMarginPoint): string {
  const fees = p.gatewayFee + p.revenueTax + p.checkoutFee;
  return [
    p.date,
    brNumber(p.faturamento),
    brNumber(p.cogsCoveragePct, 1),
    brNumber(p.cogsValid),
    brNumber(p.adSpend),
    brNumber(p.adMetaRaw),
    brNumber(p.adMetaTax),
    brNumber(p.adGoogle),
    brNumber(fees),
    brNumber(p.gatewayFee),
    brNumber(p.revenueTax),
    brNumber(p.checkoutFee),
    brNumber(p.cogsInvalid),
    brNumber(p.cogsInvalidReenvio),
    brNumber(p.cogsInvalidTroca),
    brNumber(p.cogsInvalidVoucher),
    brNumber(p.cogsInvalidZerado),
    brNumber(p.performanceProfit),
    brNumber(p.performanceMargin, 2),
    brNumber(p.operationalProfit),
    brNumber(p.operationalMargin, 2),
  ].join(";");
}

function buildTotalRow(t: MarginTotals): string {
  const fees = t.gatewayFee + t.revenueTax + t.checkoutFee;
  return [
    "Total",
    brNumber(t.faturamento),
    brNumber(t.cogsCoveragePct, 1),
    brNumber(t.cogsValid),
    brNumber(t.adSpend),
    brNumber(t.adMetaRaw),
    brNumber(t.adMetaTax),
    brNumber(t.adGoogle),
    brNumber(fees),
    brNumber(t.gatewayFee),
    brNumber(t.revenueTax),
    brNumber(t.checkoutFee),
    brNumber(t.cogsInvalid),
    brNumber(t.cogsInvalidReenvio),
    brNumber(t.cogsInvalidTroca),
    brNumber(t.cogsInvalidVoucher),
    brNumber(t.cogsInvalidZerado),
    brNumber(t.performanceProfit),
    brNumber(t.performanceMargin, 2),
    brNumber(t.operationalProfit),
    brNumber(t.operationalMargin, 2),
  ].join(";");
}

export function ExportCsvButton({ month, daily, totals }: Props) {
  const handleClick = () => {
    const lines = [
      HEADERS.join(";"),
      ...daily.map(buildRow),
      buildTotalRow(totals),
    ];
    // BOM pra Excel reconhecer UTF-8.
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-margem-${month}.csv`;
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
