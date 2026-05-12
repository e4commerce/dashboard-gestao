import "server-only";
import { mpGet } from "./client";

export type MpPaymentRow = {
  id: string;
  status: string | null;
  statusDetail: string | null;
  dateCreated: Date | null;
  dateApproved: Date | null;
  transactionAmount: number | null;
  feeAmount: number; // soma de mercadopago_fee
  netReceivedAmount: number | null;
  externalReference: string | null;
  paymentMethodId: string | null;
  paymentTypeId: string | null;
  currency: string | null;
};

type FeeDetail = { type: string; amount: number };

type PaymentResource = {
  id: number | string;
  status?: string;
  status_detail?: string;
  date_created?: string;
  date_approved?: string;
  transaction_amount?: number;
  transaction_details?: {
    net_received_amount?: number;
  };
  fee_details?: FeeDetail[];
  external_reference?: string | null;
  payment_method_id?: string;
  payment_type_id?: string;
  currency_id?: string;
};

type SearchResponse = {
  paging: { total: number; limit: number; offset: number };
  results: PaymentResource[];
};

const PAGE_LIMIT = 100;

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function sumMpFees(details: FeeDetail[] | undefined): number {
  if (!details) return 0;
  // Apenas a taxa do Mercado Pago propriamente — ignoramos shipping, etc.
  return details
    .filter(
      (d) =>
        d.type === "mercadopago_fee" ||
        d.type === "application_fee" ||
        d.type === "financing_fee",
    )
    .reduce((s, d) => s + (Number(d.amount) || 0), 0);
}

// Busca pagamentos no período via /v1/payments/search.
// Pagina por offset até esgotar. Usa date_approved porque é quando a taxa
// efetivamente é cobrada.
export async function fetchPaymentsInRange(
  dateFrom: Date,
  dateTo: Date,
  onPage?: (batch: MpPaymentRow[]) => void | Promise<void>,
): Promise<MpPaymentRow[]> {
  const all: MpPaymentRow[] = [];
  let offset = 0;
  const begin = dateFrom.toISOString();
  const end = dateTo.toISOString();

  while (true) {
    const res: SearchResponse = await mpGet<SearchResponse>(
      "/v1/payments/search",
      {
        sort: "date_approved",
        criteria: "asc",
        range: "date_approved",
        begin_date: begin,
        end_date: end,
        limit: PAGE_LIMIT,
        offset,
      },
    );

    const batch: MpPaymentRow[] = res.results.map((p) => ({
      id: String(p.id),
      status: p.status ?? null,
      statusDetail: p.status_detail ?? null,
      dateCreated: parseDate(p.date_created),
      dateApproved: parseDate(p.date_approved),
      transactionAmount: p.transaction_amount ?? null,
      feeAmount: sumMpFees(p.fee_details),
      netReceivedAmount: p.transaction_details?.net_received_amount ?? null,
      externalReference: p.external_reference ?? null,
      paymentMethodId: p.payment_method_id ?? null,
      paymentTypeId: p.payment_type_id ?? null,
      currency: p.currency_id ?? null,
    }));

    all.push(...batch);
    if (onPage) await onPage(batch);

    if (batch.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
    if (offset >= res.paging.total) break;
  }

  return all;
}
