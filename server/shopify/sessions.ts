import "server-only";
import { executeGraphQL } from "./graphql";

type ShopifyqlColumn = { name: string; dataType: string };

type ShopifyqlTableData = {
  rowData: string[][];
  columns: ShopifyqlColumn[];
};

type ShopifyqlTableResponse = {
  __typename: "TableResponse";
  tableData: ShopifyqlTableData;
};

type ShopifyqlParseError = {
  code: string;
  message: string;
};

type ShopifyqlResponse =
  | ShopifyqlTableResponse
  | { __typename: string; parseErrors?: ShopifyqlParseError[] };

type ShopifyqlQueryResult = {
  shopifyqlQuery: ShopifyqlResponse & { parseErrors?: ShopifyqlParseError[] };
};

const SHOPIFYQL_MUTATION = `
mutation shopifyqlQuery($query: String!) {
  shopifyqlQuery(query: $query) {
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
`;

export type DailySessionsRow = {
  date: string; // YYYY-MM-DD
  sessions: number;
};

export async function fetchDailySessions(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailySessionsRow[]> {
  const since = dateFrom.toISOString().slice(0, 10);
  const until = dateTo.toISOString().slice(0, 10);

  const query = `FROM sessions SINCE ${since} UNTIL ${until} GROUP BY day`;

  const result = await executeGraphQL<ShopifyqlQueryResult>(
    SHOPIFYQL_MUTATION,
    { query },
  );

  const response = result.shopifyqlQuery;

  if (response.parseErrors && response.parseErrors.length > 0) {
    throw new Error(
      `ShopifyQL parse errors: ${response.parseErrors.map((e) => e.message).join("; ")}`,
    );
  }

  if (response.__typename !== "TableResponse") {
    throw new Error(`Unexpected ShopifyQL response type: ${response.__typename}`);
  }

  const tableResponse = response as ShopifyqlTableResponse;
  const { columns, rowData } = tableResponse.tableData;

  // Find column indexes dynamically — Shopify may return them in any order.
  const dayIdx = columns.findIndex((c) =>
    c.name === "day" || c.name === "session_date" || c.name === "date",
  );
  const sessionsIdx = columns.findIndex((c) =>
    c.name === "sessions" || c.name === "sessions_count" || c.name === "visits",
  );

  if (dayIdx === -1 || sessionsIdx === -1) {
    throw new Error(
      `ShopifyQL sessions: could not find expected columns. Got: ${columns.map((c) => c.name).join(", ")}`,
    );
  }

  return rowData
    .map((row) => ({
      date: String(row[dayIdx]).slice(0, 10),
      sessions: parseInt(String(row[sessionsIdx]), 10) || 0,
    }))
    .filter((r) => r.date.length === 10);
}
