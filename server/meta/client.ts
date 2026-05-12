import "server-only";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function getToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");
  return token;
}

type GraphErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly subcode?: number,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

// GET genérico com retry exponencial para erros transientes.
export async function metaGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", getToken());
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { cache: "no-store" });
      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new MetaGraphError(
          `Meta retornou resposta não-JSON (status ${res.status}): ${text.slice(0, 200)}`,
        );
      }

      if (!res.ok || (data as GraphErrorResponse).error) {
        const err = (data as GraphErrorResponse).error;
        // Códigos 1, 2, 4, 17, 32, 613 são rate limit / transientes
        const transient = err?.code != null && [1, 2, 4, 17, 32, 613].includes(err.code);
        if (transient && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw new MetaGraphError(
          err?.message ?? `Meta error status ${res.status}`,
          err?.code,
          err?.error_subcode,
        );
      }
      return data as T;
    } catch (err) {
      lastErr = err;
      // network errors → retry
      if (err instanceof MetaGraphError) throw err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastErr;
}

// Resolve "act_X" e "X" para a forma com prefixo "act_" (que a Graph API espera).
export function normalizeAccountId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

// Lista de contas descobertas via /me/adaccounts.
// Pagina automaticamente até esgotar.
export type DiscoveredAccount = {
  id: string; // "act_X"
  name: string;
  currency?: string;
  accountStatus?: number;
};

type AdAccountsResponse = {
  data: Array<{
    id: string;
    name: string;
    currency?: string;
    account_status?: number;
  }>;
  paging?: { next?: string };
};

export async function listMyAdAccounts(): Promise<DiscoveredAccount[]> {
  const all: DiscoveredAccount[] = [];
  let path: string | null = "/me/adaccounts";
  let queryParams: Record<string, string | number> | null = {
    fields: "id,name,account_status,currency",
    limit: 100,
  };

  while (path) {
    const res: AdAccountsResponse = await metaGet<AdAccountsResponse>(
      path,
      queryParams ?? {},
    );
    for (const row of res.data) {
      all.push({
        id: row.id,
        name: row.name,
        currency: row.currency,
        accountStatus: row.account_status,
      });
    }
    if (res.paging?.next) {
      const next = new URL(res.paging.next);
      path = next.pathname.replace(/^\/v\d+\.\d+/, "");
      queryParams = Object.fromEntries(next.searchParams.entries());
      delete (queryParams as Record<string, string>).access_token;
    } else {
      path = null;
      queryParams = null;
    }
  }
  return all;
}

// Inspeciona o token e retorna a data de expiração (ou null se nunca expira).
type DebugTokenResponse = {
  data: {
    expires_at: number; // unix seconds; 0 = nunca expira
    is_valid: boolean;
    scopes?: string[];
  };
};

export async function getTokenInfo(): Promise<{
  expiresAt: Date | null;
  isValid: boolean;
  scopes: string[];
}> {
  const token = getToken();
  const data = await metaGet<DebugTokenResponse>("/debug_token", {
    input_token: token,
  });
  const expSec = data.data.expires_at;
  return {
    expiresAt: expSec === 0 ? null : new Date(expSec * 1000),
    isValid: data.data.is_valid,
    scopes: data.data.scopes ?? [],
  };
}
