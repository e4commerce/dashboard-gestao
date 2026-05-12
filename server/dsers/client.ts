import "server-only";

export type DsersOrder = {
  dsersOrderId: string;
  name: string;
  productCostCents: number;
  shippingCostCents: number;
  totalCostCents: number;
  // Resposta crua do DSers — preservada para snapshot durável no banco
  raw: unknown;
};

type DsersResponse = {
  total: number;
  orders: Array<{
    id: string;
    name: string;
    totalCost: { settingMoney: string };
    productCost: { settingMoney: string };
    shippingCost: { settingMoney: string };
    [key: string]: unknown;
  }>;
};

function config() {
  const rawUrl = process.env.PROFITFY_API_URL;
  const apiKey = process.env.PROFITFY_API_KEY;
  if (!rawUrl || !apiKey) {
    throw new Error(
      "DSers não configurado. Defina PROFITFY_API_URL e PROFITFY_API_KEY em .env.local",
    );
  }
  const baseUrl = rawUrl.replace(/\/$/, "").replace(/\/api$/, "");
  return { baseUrl, apiKey };
}

// POST /api/v1/dsers/orders — fonte da verdade para custos reais
// Retorna apenas pedidos efetivamente processados no DSers.
// startUnix / endUnix em segundos (inclusivos nas duas pontas).
export async function fetchDsersOrders(
  startUnix: number,
  endUnix: number,
): Promise<DsersOrder[]> {
  const { baseUrl, apiKey } = config();

  const res = await fetch(`${baseUrl}/api/v1/dsers/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      startTime: String(startUnix),
      endTime: String(endUnix),
    }),
    cache: "no-store",
    // A API leva ~40-50s por dia de janela. Timeout de 90s dá folga
    // sem deixar travar indefinidamente em caso de problema.
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DSers API ${res.status}: ${body || res.statusText}`);
  }

  const data = (await res.json()) as DsersResponse;
  return (data.orders ?? []).map((o) => ({
    dsersOrderId: o.id,
    name: o.name,
    productCostCents: parseInt(o.productCost?.settingMoney ?? "0", 10),
    shippingCostCents: parseInt(o.shippingCost?.settingMoney ?? "0", 10),
    totalCostCents: parseInt(o.totalCost?.settingMoney ?? "0", 10),
    raw: o,
  }));
}
