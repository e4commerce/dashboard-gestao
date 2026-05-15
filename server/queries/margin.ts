import "server-only";
import {
  getDailyCosts,
  getDailyInvalidReasonBreakdown,
  type DailyCostPoint,
  type DailyInvalidReasonRow,
} from "./costs";
import { getDailyAdSpend } from "./ads";
import { META_TAX_MULTIPLIER } from "@/server/meta/tax";
import { toIsoDateSP } from "@/lib/datetime";

const EMPTY_REASONS: Omit<DailyInvalidReasonRow, "date"> = {
  reenvio: 0,
  troca: 0,
  voucher: 0,
  zerado: 0,
};

// Alíquotas fixas aplicadas sobre o faturamento dos pedidos válidos.
export const REVENUE_TAX_RATE = 0.0172; // imposto
export const CHECKOUT_FEE_RATE = 0.01;  // taxa de checkout

// Estimativa de COGS para pedidos não-sincronizados:
// Quando a cobertura DSers do dia está abaixo deste limiar, aplicamos uma
// taxa estimada (cogs/receita média dos últimos 7 dias com dados) sobre a
// receita não-sincronizada do dia. Acima do limiar, confiamos só no real.
const COVERAGE_THRESHOLD_PCT = 99;
const ROLLING_WINDOW_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Lucro é a soma/subtração transparente das mesmas células exibidas na tabela:
// faturamento − (custo produto real + estimado) − mídia − taxas − custo op.
export type DailyMarginPoint = {
  date: string;
  faturamento: number;          // receita total dos pedidos válidos
  cogsValid: number;            // custo de produto real (pedidos sincronizados)
  cogsValidEstimated: number;   // estimativa para os não-sincronizados (0 se não aplicado)
  cogsRateUsed: number | null;  // taxa cogs/receita aplicada (null = sem estimativa)
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
  cogsValidTotal: number;
  cogsInvalid: number;
  adSpend: number;
  gatewayFee: number;
  revenueTax: number;
  checkoutFee: number;
}) {
  const performance =
    input.faturamento -
    input.cogsValidTotal -
    input.adSpend -
    input.gatewayFee -
    input.revenueTax -
    input.checkoutFee;
  const operational = performance - input.cogsInvalid;
  return { performance, operational };
}

// Taxa cogs/receita observada na janela móvel imediatamente anterior ao dia.
// Retorna null quando a janela não tem nenhum pedido sincronizado.
function rollingCogsRate(
  targetIsoDate: string,
  costsByDate: Map<string, DailyCostPoint>,
): number | null {
  const target = new Date(`${targetIsoDate}T03:00:00.000Z`); // 00:00 SP
  let cogs = 0;
  let revenue = 0;
  for (let i = 1; i <= ROLLING_WINDOW_DAYS; i++) {
    const past = new Date(target.getTime() - i * ONE_DAY_MS);
    const c = costsByDate.get(toIsoDateSP(past));
    if (!c) continue;
    cogs += c.validCogs;
    revenue += c.validRevenue;
  }
  return revenue > 0 ? cogs / revenue : null;
}

export async function getMarginAnalysis(
  dateFrom: Date,
  dateTo: Date,
): Promise<MarginAnalysis> {
  // Estende a janela de custos 7 dias para trás para alimentar a estimativa
  // dos primeiros dias do período exibido.
  const extendedFrom = new Date(dateFrom.getTime() - ROLLING_WINDOW_DAYS * ONE_DAY_MS);

  const [costsExtended, ads, invalidReasons] = await Promise.all([
    getDailyCosts(extendedFrom, dateTo),
    getDailyAdSpend(dateFrom, dateTo),
    getDailyInvalidReasonBreakdown(dateFrom, dateTo),
  ]);

  const costsByDate = new Map<string, DailyCostPoint>();
  for (const c of costsExtended) costsByDate.set(c.date, c);

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

  const dateFromKey = toIsoDateSP(dateFrom);
  const dateToKeyExclusive = toIsoDateSP(dateTo);

  const daily: DailyMarginPoint[] = [];
  for (const c of costsExtended) {
    if (c.date < dateFromKey) continue;
    if (c.date >= dateToKeyExclusive) continue;

    const faturamento = c.validRevenueTotal;
    const cogsValid = c.validCogs;
    const unsyncedRevenue = c.validRevenueTotal - c.validRevenue;

    // Decide se estima: cobertura abaixo do limiar e há receita não-sincronizada.
    let cogsValidEstimated = 0;
    let cogsRateUsed: number | null = null;
    if (
      c.validCoveragePct < COVERAGE_THRESHOLD_PCT &&
      unsyncedRevenue > 0
    ) {
      const rate = rollingCogsRate(c.date, costsByDate);
      if (rate !== null) {
        cogsRateUsed = rate;
        cogsValidEstimated = unsyncedRevenue * rate;
      }
    }
    const cogsValidTotal = cogsValid + cogsValidEstimated;

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
      cogsValidTotal,
      cogsInvalid,
      adSpend,
      gatewayFee,
      revenueTax,
      checkoutFee,
    });
    daily.push({
      date: c.date,
      faturamento,
      cogsValid,
      cogsValidEstimated,
      cogsRateUsed,
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
    });
  }

  const sum = daily.reduce(
    (acc, p) => {
      acc.faturamento += p.faturamento;
      acc.cogsValid += p.cogsValid;
      acc.cogsValidEstimated += p.cogsValidEstimated;
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
      cogsValidEstimated: 0,
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

  // Para totais usamos os pedidos do período exibido (ignora dias extras
  // usados só para a janela de estimativa).
  const periodCosts = costsExtended.filter(
    (c) => c.date >= dateFromKey && c.date < dateToKeyExclusive,
  );
  const validOrders = periodCosts.reduce((s, c) => s + c.validOrders, 0);
  const validWithCogs = periodCosts.reduce(
    (s, c) => s + c.validOrdersWithCogs,
    0,
  );

  const { performance, operational } = computeProfits({
    faturamento: sum.faturamento,
    cogsValidTotal: sum.cogsValid + sum.cogsValidEstimated,
    cogsInvalid: sum.cogsInvalid,
    adSpend: sum.adSpend,
    gatewayFee: sum.gatewayFee,
    revenueTax: sum.revenueTax,
    checkoutFee: sum.checkoutFee,
  });

  // Taxa "média ponderada" do período: cogs estimado / base de receita que
  // recebeu estimativa. Só informativa, exibida no total.
  let revenueWithEstimate = 0;
  for (const p of daily) {
    if (p.cogsRateUsed !== null && p.cogsRateUsed > 0) {
      revenueWithEstimate += p.cogsValidEstimated / p.cogsRateUsed;
    }
  }
  const totalRateUsed =
    revenueWithEstimate > 0
      ? sum.cogsValidEstimated / revenueWithEstimate
      : null;

  const totals: MarginTotals = {
    ...sum,
    cogsRateUsed: totalRateUsed,
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
