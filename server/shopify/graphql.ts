import "server-only";
import { getAccessToken, getStoreUrl } from "./auth";

const API_VERSION = "2025-01";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function executeGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {},
  attempt = 0,
): Promise<T> {
  const token = await getAccessToken();
  const storeUrl = getStoreUrl();

  const res = await fetch(
    `https://${storeUrl}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (res.status === 429 && attempt < 5) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "2");
    await sleep((retryAfter + Math.random()) * 1000);
    return executeGraphQL<T>(query, variables, attempt + 1);
  }

  if (res.status >= 500 && attempt < 3) {
    await sleep(Math.pow(2, attempt) * 500);
    return executeGraphQL<T>(query, variables, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `Shopify GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!json.data) {
    throw new Error("Shopify GraphQL returned no data");
  }

  return json.data;
}
