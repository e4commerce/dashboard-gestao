import "server-only";

const MP_BASE = "https://api.mercadopago.com";

function getToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
  return token;
}

export class MpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MpError";
  }
}

// GET genérico com retry exponencial para 429/5xx.
export async function mpGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${MP_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw new MpError(`MP rate-limit/5xx (status ${res.status})`, res.status);
      }
      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new MpError(
          `MP retornou resposta não-JSON (status ${res.status}): ${text.slice(0, 200)}`,
          res.status,
        );
      }
      if (!res.ok) {
        const msg =
          (data as { message?: string })?.message ??
          `MP error status ${res.status}`;
        throw new MpError(msg, res.status);
      }
      return data as T;
    } catch (err) {
      lastErr = err;
      if (err instanceof MpError && err.status && err.status < 500 && err.status !== 429) {
        throw err;
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastErr;
}
