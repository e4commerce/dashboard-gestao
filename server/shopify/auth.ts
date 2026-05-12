import "server-only";

type CachedToken = { token: string; expiresAt: number };

let cached: CachedToken | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 5 * 60_000) {
    return cached.token;
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const storeUrl = process.env.SHOPIFY_STORE_URL;

  if (!clientId || !clientSecret || !storeUrl) {
    throw new Error(
      "Shopify env vars missing (SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_STORE_URL)",
    );
  }

  const res = await fetch(`https://${storeUrl}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const ttl = (data.expires_in ?? 3600) * 1000;
  cached = { token: data.access_token, expiresAt: now + ttl };
  return data.access_token;
}

export function getStoreUrl(): string {
  const url = process.env.SHOPIFY_STORE_URL;
  if (!url) throw new Error("SHOPIFY_STORE_URL is not set");
  return url;
}

export function clearTokenCache(): void {
  cached = null;
}
