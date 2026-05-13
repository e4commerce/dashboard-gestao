import { NextResponse } from "next/server";
import { getAccessToken, getStoreUrl } from "@/server/shopify/auth";
import { clearTokenCache } from "@/server/shopify/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_VERSION = "2025-01";

// Testa o acesso ao ShopifyQL: limpa cache de token, autentica novamente,
// e executa uma query simples para verificar se o scope read_analytics está ativo.
export async function GET(req: Request) {
  const secret = req.headers.get("x-debug-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Força re-autenticação para pegar token com scopes atualizados.
  clearTokenCache();

  try {
    const token = await getAccessToken();
    const storeUrl = getStoreUrl();

    // Instrospect para verificar se shopifyqlQuery existe no schema.
    const introspect = await fetch(
      `https://${storeUrl}/admin/api/${API_VERSION}/graphql.json`,
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

    const introspectJson = await introspect.json() as {
      data?: { __type?: { fields?: Array<{ name: string }> } };
      errors?: Array<{ message: string }>;
    };

    const mutationFields =
      introspectJson.data?.__type?.fields?.map((f) => f.name) ?? [];
    const hasShopifyql = mutationFields.includes("shopifyqlQuery");

    if (!hasShopifyql) {
      return NextResponse.json({
        ok: false,
        reason: "shopifyqlQuery não encontrado no schema — provavelmente falta o scope read_analytics ou o plano não suporta",
        availableMutations: mutationFields.filter((f) =>
          f.toLowerCase().includes("analyt") ||
          f.toLowerCase().includes("report") ||
          f.toLowerCase().includes("shopifyql"),
        ),
        tokenObtained: true,
      });
    }

    // Se existe, testa com uma query mínima (hoje).
    const today = new Date().toISOString().slice(0, 10);
    const testRes = await fetch(
      `https://${storeUrl}/admin/api/${API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          query: `
            mutation runShopifyql($query: String!) {
              shopifyqlQuery(query: $query) {
                __typename
                ... on TableResponse {
                  tableData { columns { name dataType } rowData }
                }
                parseErrors { code message }
              }
            }
          `,
          variables: {
            query: `FROM sessions SINCE ${today} UNTIL ${today} GROUP BY day`,
          },
        }),
      },
    );

    const testJson = await testRes.json();
    return NextResponse.json({ ok: true, hasShopifyql: true, testResult: testJson });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
