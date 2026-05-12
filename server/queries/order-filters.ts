import "server-only";
import { orders } from "@/server/db/schema";
import { and, eq, gt, ilike, isNull, not, or } from "drizzle-orm";

// Filtro canônico de pedidos válidos para análise de receita/lucro.
// Aplicado em todas as queries de métricas e gráficos.
export const validOrder = and(
  eq(orders.financialStatus, "PAID"),
  gt(orders.totalPrice, "0"),
  or(isNull(orders.discountCodes), not(ilike(orders.discountCodes, "%TROCA%"))),
  or(isNull(orders.discountCodes), not(ilike(orders.discountCodes, "%VOUCHER%"))),
  or(isNull(orders.tags), not(ilike(orders.tags, "%Reenvio%"))),
);

// Pedidos "inválidos" para receita mas que TÊM custo operacional:
// zerado, troca, voucher ou reenvio. PAID mas não geram receita líquida.
export const invalidOrder = and(
  eq(orders.financialStatus, "PAID"),
  or(
    eq(orders.totalPrice, "0"),
    ilike(orders.discountCodes, "%TROCA%"),
    ilike(orders.discountCodes, "%VOUCHER%"),
    ilike(orders.tags, "%Reenvio%"),
  ),
);

// Apenas pedidos com COGS realmente sincronizado da Profitfy.
// cogs_amount = 0 significa "Profitfy ainda não puxou do DSers" → tratamos como
// não sincronizado e excluímos dos cálculos de margem/lucro.
export const hasCogs = gt(orders.cogsAmount, "0");
