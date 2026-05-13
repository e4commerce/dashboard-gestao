import "server-only";
import { getAccessToken, getStoreUrl } from "./auth";

// shopifyqlQuery foi introduzida na 2022-10 e confirmada na 2024-04.
// Usa versão própria para não depender da versão global em graphql.ts.
const SESSIONS_API_VERSION = "2024-04";

type ShopifyqlColumn = { name: string; dataType: string };
type ShopifyqlTableResponse = {
  __typename: "TableResponse";
  tableData: {
    rowData: string[][];
    columns: ShopifyqlColumn[];
  };
};
type ShopifyqlParseError = { code: string; message: string };
type ShopifyqlResult = {
  shopifyqlQuery: (ShopifyqlTableResponse | { __typename: string }) & {
    parseErrors?: ShopifyqlParseError[];
  };
};
type GqlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

export type DailySessionsRow = {
  date: string; // YYYY-MM-DD
  sessions: number;
};

export async function fetchDailySessions(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailySessionsRow[]> {
  const token = await getAccessToken();
  const storeUrl = getStoreUrl();
  const since = dateFrom.toISOString().slice(0, 10);
  const until = dateTo.toISOString().slice(0, 10);

  const res = await fetch(
    `https://${storeUrl}/admin/api/${SESSIONS_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: `
          mutation RunShopifyQL($q: String!) {
            shopifyqlQuery(query: $q) {
              __typename
              ... on TableResponse {
                tableData {
                  rowData
                  columns { name dataType }
                }
              }
              parseErrors { code message }
            }
          }
        `,
        variables: { q: `FROM sessions SINCE ${since} UNTIL ${until} GROUP BY day` },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify sessions HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as GqlResponse<ShopifyqlResult>;

  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `Shopify GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }

  const response = json.data?.shopifyqlQuery;
  if (!response) throw new Error("Shopify sessions: no data returned");

  if (response.parseErrors && response.parseErrors.length > 0) {
    throw new Error(
      `ShopifyQL parse errors: ${response.parseErrors.map((e) => e.message).join("; ")}`,
    );
  }

  if (response.__typename !== "TableResponse") {
    throw new Error(`Unexpected ShopifyQL response type: ${response.__typename}`);
  }

  const { columns, rowData } = (response as ShopifyqlTableResponse).tableData;

  const dayIdx = columns.findIndex(
    (c) => c.name === "day" || c.name === "session_date" || c.name === "date",
  );
  const sessionsIdx = columns.findIndex(
    (c) => c.name === "sessions" || c.name === "sessions_count" || c.name === "visits",
  );

  if (dayIdx === -1 || sessionsIdx === -1) {
    throw new Error(
      `ShopifyQL sessions: colunas inesperadas. Recebidas: ${columns.map((c) => c.name).join(", ")}`,
    );
  }

  return rowData
    .map((row) => ({
      date: String(row[dayIdx]).slice(0, 10),
      sessions: parseInt(String(row[sessionsIdx]), 10) || 0,
    }))
    .filter((r) => r.date.length === 10);
}
