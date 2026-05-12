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

// Receita / taxas exibidas são totais dos pedidos válidos (com ou sem COGS).
// O lucro, no entanto, é calculado apenas com pedidos cujo COGS já foi
// sincronizado — receita e custo precisam estar pareados para não distorcer.
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
  revenueTax: number;           // faturamento total * REVENUE_TAX_RATE
  checkoutFee: number;          // faturamento total * CHECKOUT_FEE_RATE
  performanceProfit: number;    // calc usa apenas pedidos sincronizados
  operationalProfit: number;    // performance - cogsInvalid
  performanceMargin: number;    // % sobre receita sincronizada
  operationalMargin: number;    // % sobre receita sincronizada
};

export type MarginTotals = Omit<DailyMarginPoint, "date">;

export type MarginAnalysis = {
  daily: DailyMarginPoint[];
  totals: MarginTotals;
};

// Lucro: receita e custo de produto pareados (só pedidos sincronizados).
// Imposto e checkout proporcionais à receita sincronizada para manter o lucro
// internamente consistente; mídia e gateway entram integrais (custos de canal).
function computeProfits(input: {
  syncedRevenue: number;
  cogsValid: number;
  cogsInvalid: number;
  adSpend: number;
  gatewayFee: number;
}) {
  const syncedTax = input.syncedRevenue * REVENUE_TAX_RATE;
  const syncedCheckout = input.syncedRevenue * CHECKOUT_FEE_RATE;
  const performance =
    input.syncedRevenue -
    input.cogsValid -
    input.adSpend -
    input.gatewayFee -
    syncedTax -
    syncedCheckout;
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

  let totalSyncedRevenue = 0;
  const daily: DailyMarginPoint[] = costs.map((c) => {
    const faturamento = c.validRevenueTotal;
    const syncedRevenue = c.validRevenue;
    totalSyncedRevenue += syncedRevenue;
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
      syncedRevenue,
      cogsValid,
      cogsInvalid,
      adSpend,
      gatewayFee,
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
        syncedRevenue > 0 ? (performance / syncedRevenue) * 100 : 0,
      operationalMargin:
        syncedRevenue > 0 ? (operational / syncedRevenue) * 100 : 0,
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
    syncedRevenue: totalSyncedRevenue,
    cogsValid: sum.cogsValid,
    cogsInvalid: sum.cogsInvalid,
    adSpend: sum.adSpend,
    gatewayFee: sum.gatewayFee,
  });

  const totals: MarginTotals = {
    ...sum,
    cogsCoveragePct: validOrders > 0 ? (validWithCogs / validOrders) * 100 : 0,
    performanceProfit: performance,
    operationalProfit: operational,
    performanceMargin:
      totalSyncedRevenue > 0
        ? (performance / totalSyncedRevenue) * 100
        : 0,
    operationalMargin:
      totalSyncedRevenue > 0
        ? (operational / totalSyncedRevenue) * 100
        : 0,
  };

  return { daily, totals };
}
