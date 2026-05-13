import "server-only";
import {
  getDailyCosts,
  getDailyInvalidReasonBreakdown,
  type DailyInvalidReasonRow,
} from "./costs";
import { getDailyAdSpend } from "./ads";
import { META_TAX_MULTIPLIER } from "@/server/meta/tax";

const EMPTY_REASONS: Omit<DailyInvalidReasonRow, "date"> = {
  reenvio: 0,
  troca: 0,
  voucher: 0,
  zerado: 0,
};

// Alíquotas fixas aplicadas sobre o faturamento dos pedidos válidos.
export const REVENUE_TAX_RATE = 0.0172; // imposto
export const CHECKOUT_FEE_RATE = 0.01;  // taxa de checkout

// Lucro é a soma/subtração transparente das mesmas células exibidas na tabela:
// faturamento − custo produto − mídia − (gateway + imposto + checkout) − custo op.
// Pedidos sem COGS sincronizado contribuem com receita mas não com custo de
// produto (não há como saber o COGS deles ainda); a coluna de cobertura sinaliza
// o gap, e o resultado é otimista enquanto a cobertura está abaixo de 100%.
export type DailyMarginPoint = {
  date: string;
  faturamento: number;          // receita total dos pedidos válidos
  cogsValid: number;            // custo de produto (apenas pedidos sincronizados)
  cogsInvalid: number;          // custo operacional (troca/voucher/reenvio/zerado)
  cogsInvalidReenvio: number;
  cogsInvalidTroca: number;
  cogsInvalidVoucher: number;
  cogsInvalidZerado: number;
  cogsCoveragePct: number;      // cobertura DSers nos pedidos válidos
  adSpend: number;              // mídia paga total (Meta com gross-up + Google)
  adMetaRaw: number;            // gasto Meta sem imposto
  adMetaTax: number;            // imposto sobre Meta (CIDE+IOF+ISS)
  adGoogle: number;             // gasto Google
  gatewayFee: number;           // taxa Mercado Pago
  revenueTax: number;           // faturamento * REVENUE_TAX_RATE
  checkoutFee: number;          // faturamento * CHECKOUT_FEE_RATE
  performanceProfit: number;    // sem cogsInvalid
  operationalProfit: number;    // performance - cogsInvalid
  performanceMargin: number;    // % sobre faturamento
  operationalMargin: number;    // % sobre faturamento
};

export type MarginTotals = Omit<DailyMarginPoint, "date">;

export type MarginAnalysis = {
  daily: DailyMarginPoint[];
  totals: MarginTotals;
};

function computeProfits(input: {
  faturamento: number;
  cogsValid: number;
  cogsInvalid: number;
  adSpend: number;
  gatewayFee: number;
  revenueTax: number;
  checkoutFee: number;
}) {
  const performance =
    input.faturamento -
    input.cogsValid -
    input.adSpend -
    input.gatewayFee -
    input.revenueTax -
    input.checkoutFee;
  const operational = performance - input.cogsInvalid;
  return { performance, operational };
}

export async function getMarginAnalysis(
  dateFrom: Date,
  dateTo: Date,
): Promise<MarginAnalysis> {
  const [costs, ads, invalidReasons] = await Promise.all([
    getDailyCosts(dateFrom, dateTo),
    getDailyAdSpend(dateFrom, dateTo),
    getDailyInvalidReasonBreakdown(dateFrom, dateTo),
  ]);

  const reasonByDate = new Map<string, DailyInvalidReasonRow>();
  for (const r of invalidReasons) reasonByDate.set(r.date, r);

  const adByDate = new Map<
    string,
    { total: number; metaGross: number; google: number }
  >();
  for (const a of ads) {
    adByDate.set(a.date, {
      total: a.total.spend,
      metaGross: a.meta.spend,
      google: a.google.spend,
    });
  }

  const daily: DailyMarginPoint[] = costs.map((c) => {
    const faturamento = c.validRevenueTotal;
    const cogsValid = c.validCogs;
    const cogsInvalid = c.invalidCogs;
    const reasons = reasonByDate.get(c.date) ?? {
      date: c.date,
      ...EMPTY_REASONS,
    };
    const ad = adByDate.get(c.date) ?? { total: 0, metaGross: 0, google: 0 };
    const adSpend = ad.total;
    const adMetaRaw = ad.metaGross / META_TAX_MULTIPLIER;
    const adMetaTax = ad.metaGross - adMetaRaw;
    const adGoogle = ad.google;
    const gatewayFee = c.mpFee;
    const revenueTax = faturamento * REVENUE_TAX_RATE;
    const checkoutFee = faturamento * CHECKOUT_FEE_RATE;
    const { performance, operational } = computeProfits({
      faturamento,
      cogsValid,
      cogsInvalid,
      adSpend,
      gatewayFee,
      revenueTax,
      checkoutFee,
    });
    return {
      date: c.date,
      faturamento,
      cogsValid,
      cogsInvalid,
      cogsInvalidReenvio: reasons.reenvio,
      cogsInvalidTroca: reasons.troca,
      cogsInvalidVoucher: reasons.voucher,
      cogsInvalidZerado: reasons.zerado,
      cogsCoveragePct: c.validCoveragePct,
      adSpend,
      adMetaRaw,
      adMetaTax,
      adGoogle,
      gatewayFee,
      revenueTax,
      checkoutFee,
      performanceProfit: performance,
      operationalProfit: operational,
      performanceMargin:
        faturamento > 0 ? (performance / faturamento) * 100 : 0,
      operationalMargin:
        faturamento > 0 ? (operational / faturamento) * 100 : 0,
    };
  });

  const sum = daily.reduce(
    (acc, p) => {
      acc.faturamento += p.faturamento;
      acc.cogsValid += p.cogsValid;
      acc.cogsInvalid += p.cogsInvalid;
      acc.cogsInvalidReenvio += p.cogsInvalidReenvio;
      acc.cogsInvalidTroca += p.cogsInvalidTroca;
      acc.cogsInvalidVoucher += p.cogsInvalidVoucher;
      acc.cogsInvalidZerado += p.cogsInvalidZerado;
      acc.adSpend += p.adSpend;
      acc.adMetaRaw += p.adMetaRaw;
      acc.adMetaTax += p.adMetaTax;
      acc.adGoogle += p.adGoogle;
      acc.gatewayFee += p.gatewayFee;
      acc.revenueTax += p.revenueTax;
      acc.checkoutFee += p.checkoutFee;
      return acc;
    },
    {
      faturamento: 0,
      cogsValid: 0,
      cogsInvalid: 0,
      cogsInvalidReenvio: 0,
      cogsInvalidTroca: 0,
      cogsInvalidVoucher: 0,
      cogsInvalidZerado: 0,
      adSpend: 0,
      adMetaRaw: 0,
      adMetaTax: 0,
      adGoogle: 0,
      gatewayFee: 0,
      revenueTax: 0,
      checkoutFee: 0,
    },
  );

  const validOrders = costs.reduce((s, c) => s + c.validOrders, 0);
  const validWithCogs = costs.reduce((s, c) => s + c.validOrdersWithCogs, 0);
  const { performance, operational } = computeProfits({
    faturamento: sum.faturamento,
    cogsValid: sum.cogsValid,
    cogsInvalid: sum.cogsInvalid,
    adSpend: sum.adSpend,
    gatewayFee: sum.gatewayFee,
    revenueTax: sum.revenueTax,
    checkoutFee: sum.checkoutFee,
  });

  const totals: MarginTotals = {
    ...sum,
    cogsCoveragePct: validOrders > 0 ? (validWithCogs / validOrders) * 100 : 0,
    performanceProfit: performance,
    operationalProfit: operational,
    performanceMargin:
      sum.faturamento > 0 ? (performance / sum.faturamento) * 100 : 0,
    operationalMargin:
      sum.faturamento > 0 ? (operational / sum.faturamento) * 100 : 0,
  };

  return { daily, totals };
}
