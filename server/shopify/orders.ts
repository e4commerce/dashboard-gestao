import "server-only";
import { executeGraphQL } from "./graphql";

const ORDERS_QUERY = /* GraphQL */ `
  query getOrders($query: String!, $cursor: String) {
    orders(first: 250, query: $query, after: $cursor, sortKey: CREATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          displayFinancialStatus
          displayFulfillmentStatus
          sourceName
          tags
          discountCodes
          app {
            name
          }
          customerJourneySummary {
            customerOrderIndex
            daysToConversion
            ready
            firstVisit {
              source
              sourceType
              referrerUrl
              landingPage
              referralCode
              occurredAt
              utmParameters {
                source
                medium
                campaign
                content
                term
              }
            }
            lastVisit {
              source
              sourceType
              referrerUrl
              landingPage
              referralCode
              occurredAt
              utmParameters {
                source
                medium
                campaign
                content
                term
              }
            }
          }
        }
      }
    }
  }
`;

export type ShopifyVisit = {
  source: string | null;
  sourceType: string | null;
  referrerUrl: string | null;
  landingPage: string | null;
  referralCode: string | null;
  occurredAt: string | null;
  utmParameters: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  } | null;
};

export type ShopifyOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  sourceName: string | null;
  tags: string[];
  discountCodes: string[];
  app: { name: string | null } | null;
  customer: { email: string | null; displayName: string | null } | null;
  customerJourneySummary: {
    customerOrderIndex: number | null;
    daysToConversion: number | null;
    ready: boolean | null;
    firstVisit: ShopifyVisit | null;
    lastVisit: ShopifyVisit | null;
  } | null;
};

type OrdersResponse = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: ShopifyOrderNode }>;
  };
};

export async function* fetchOrdersPaginated(
  dateFrom: Date,
  dateTo: Date,
): AsyncGenerator<ShopifyOrderNode[], void, unknown> {
  const queryStr = `created_at:>=${dateFrom.toISOString()} AND created_at:<=${dateTo.toISOString()}`;
  let cursor: string | null = null;

  do {
    const data: OrdersResponse = await executeGraphQL<OrdersResponse>(
      ORDERS_QUERY,
      { query: queryStr, cursor },
    );
    yield data.orders.edges.map((e) => e.node);
    cursor = data.orders.pageInfo.hasNextPage
      ? data.orders.pageInfo.endCursor
      : null;
  } while (cursor);
}

export async function fetchAllOrders(
  dateFrom: Date,
  dateTo: Date,
): Promise<ShopifyOrderNode[]> {
  const all: ShopifyOrderNode[] = [];
  for await (const page of fetchOrdersPaginated(dateFrom, dateTo)) {
    all.push(...page);
  }
  return all;
}
