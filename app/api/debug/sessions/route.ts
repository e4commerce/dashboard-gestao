import { NextResponse } from "next/server";
import { getAccessToken, getStoreUrl, clearTokenCache } from "@/server/shopify/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function introspectMutations(storeUrl: string, token: string, version: string) {
  const res = await fetch(
    `https://${storeUrl}/admin/api/${version}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: `{ __type(name: "Mutation") { fields { name } } }`,
      }),
    },
  );
  const json = await res.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
  const all = json.data?.__type?.fields?.map((f) => f.name) ?? [];
  const analytics = all.filter((f) =>
    f.toLowerCase().includes("analyt") ||
    f.toLowerCase().includes("report") ||
    f.toLowerCase().includes("shopifyql"),
  );
  return { hasShopifyql: all.includes("shopifyqlQuery"), analytics, total: all.length };
}

export async function GET(req: Request) {
  const secret = req.headers.get("x-debug-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearTokenCache();
  const token = await getAccessToken();
  const storeUrl = getStoreUrl();

  const [v202401, v202404, v202501] = await Promise.all([
    introspectMutations(storeUrl, token, "2024-01"),
    introspectMutations(storeUrl, token, "2024-04"),
    introspectMutations(storeUrl, token, "2025-01"),
  ]);

  const workingVersion = [
    { version: "2024-01", ...v202401 },
    { version: "2024-04", ...v202404 },
    { version: "2025-01", ...v202501 },
  ];

  const best = workingVersion.find((v) => v.hasShopifyql);

  if (!best) {
    return NextResponse.json({
      ok: false,
      reason: "shopifyqlQuery não encontrado em nenhuma versão testada",
      versions: workingVersion,
    });
  }

  // Testa uma query real na versão que tem a mutation.
  const today = new Date().toISOString().slice(0, 10);
  const testRes = await fetch(
    `https://${storeUrl}/admin/api/${best.version}/graphql.json`,
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
                tableData { columns { name dataType } rowData }
              }
              parseErrors { code message }
            }
          }
        `,
        variables: { q: `FROM sessions SINCE ${today} UNTIL ${today} GROUP BY day` },
      }),
    },
  );

  const testJson = await testRes.json();
  return NextResponse.json({ ok: true, bestVersion: best.version, versions: workingVersion, testResult: testJson });
}
