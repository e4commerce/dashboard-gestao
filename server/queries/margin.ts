import "server-only";
import { getDailyCosts } from "./costs";
import { getDailyAdSpend } from "./ads";

// Alíquotas fixas aplicadas sobre o faturamento dos pedidos válidos.
export const REVENUE_TAX_RATE = 0.0172; // imposto
export const CHECKOUT_FEE_RATE = 0.01;  // taxa de checkout

export type DailyMarginPoint = {
  date: string;
  faturamento: number;          // receita dos pedidos válidos
  cogsValid: number;            // custo de produto (pedidos válidos sincronizados)
  cogsInvalid: number;          // custo operacional (troca/voucher/reenvio/zerado)
  cogsCoveragePct: number;      // cobertura DSers nos pedidos válidos
  adSpend: number;              // mídia paga (Meta com gross-up + Google)
  gatewayFee: number;           // taxa Mercado Pago
  revenueTax: number;           // faturamento * REVENUE_TAX_RATE
  checkoutFee: number;          // faturamento * CHECKOUT_FEE_RATE
  performanceProfit: number;    // sem custos dos inválidos
  operationalProfit: number;    // com custos dos inválidos
  performanceMargin: number;    // % sobre faturamento
  operationalMargin: number;    // % sobre faturamento
};

export type MarginTotals = {
  faturamento: number;
  cogsValid: number;
  cogsInvalid: number;
  cogsCoveragePct: number;
  adSpend: number;
  gatewayFee: number;
  revenueTax: number;
  checkoutFee: number;
  performanceProfit: number;
  operationalProfit: number;
  performanceMargin: number;
  operationalMargin: number;
};

export type MarginAnalysis = {
  daily: DailyMarginPoint[];
  totals: MarginTotals;
};

function profitFor(input: {
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
  const [costs, ads] = await Promise.all([
    getDailyCosts(dateFrom, dateTo),
    getDailyAdSpend(dateFrom, dateTo),
  ]);

  const adByDate = new Map<string, number>();
  for (const a of ads) adByDate.set(a.date, a.total.spend);

  const daily: DailyMarginPoint[] = costs.map((c) => {
    const faturamento = c.validRevenueTotal;
    const cogsValid = c.validCogs;
    const cogsInvalid = c.invalidCogs;
    const adSpend = adByDate.get(c.date) ?? 0;
    const gatewayFee = c.mpFee;
    const revenueTax = faturamento * REVENUE_TAX_RATE;
    const checkoutFee = faturamento * CHECKOUT_FEE_RATE;
    const { performance, operational } = profitFor({
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
      cogsCoveragePct: c.validCoveragePct,
      adSpend,
      gatewayFee,
      revenueTax,
      checkoutFee,
      performanceProfit: performance,
      operationalProfit: operational,
      performanceMargin: faturamento > 0 ? (performance / faturamento) * 100 : 0,
      operationalMargin: faturamento > 0 ? (operational / faturamento) * 100 : 0,
    };
  });

  const sum = daily.reduce(
    (acc, p) => {
      acc.faturamento += p.faturamento;
      acc.cogsValid += p.cogsValid;
      acc.cogsInvalid += p.cogsInvalid;
      acc.adSpend += p.adSpend;
      acc.gatewayFee += p.gatewayFee;
      acc.revenueTax += p.revenueTax;
      acc.checkoutFee += p.checkoutFee;
      return acc;
    },
    {
      faturamento: 0,
      cogsValid: 0,
      cogsInvalid: 0,
      adSpend: 0,
      gatewayFee: 0,
      revenueTax: 0,
      checkoutFee: 0,
    },
  );

  const validOrders = costs.reduce((s, c) => s + c.validOrders, 0);
  const validWithCogs = costs.reduce((s, c) => s + c.validOrdersWithCogs, 0);
  const { performance, operational } = profitFor(sum);

  const totals: MarginTotals = {
    ...sum,
    cogsCoveragePct: validOrders > 0 ? (validWithCogs / validOrders) * 100 : 0,
    performanceProfit: performance,
    operationalProfit: operational,
    performanceMargin: sum.faturamento > 0 ? (performance / sum.faturamento) * 100 : 0,
    operationalMargin: sum.faturamento > 0 ? (operational / sum.faturamento) * 100 : 0,
  };

  return { daily, totals };
}
