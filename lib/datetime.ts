// Helpers de data/hora alinhados ao fuso de São Paulo.
// "Mês" e "dia" no dashboard refletem o calendário local do usuário (BRT/UTC-3),
// não o calendário UTC. Como o Brasil não usa horário de verão desde 2019,
// o offset é fixo em -3h, mas usamos Intl para robustez caso algum dia mude.

const SP_TZ = "America/Sao_Paulo";

type SPParts = {
  year: number;
  month: number;
  day: number;
};

function getSPParts(d: Date): SPParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// Retorna "YYYY-MM-DD" no fuso SP
export function toIsoDateSP(d: Date): string {
  const { year, month, day } = getSPParts(d);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Retorna "YYYY-MM" no fuso SP
export function toMonthKeySP(d: Date): string {
  const { year, month } = getSPParts(d);
  return `${year}-${String(month).padStart(2, "0")}`;
}

// 00:00 SP do primeiro dia do mês de `d` (em UTC: +3h)
export function startOfMonthSP(d: Date = new Date()): Date {
  const { year, month } = getSPParts(d);
  return new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
}

// 00:00 SP do primeiro dia do mês seguinte (limite exclusivo do mês)
export function endOfMonthSP(d: Date = new Date()): Date {
  const { year, month } = getSPParts(d);
  return new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
}

// Quantidade de dias do mês de `d` (em SP)
export function daysInMonthSP(d: Date = new Date()): number {
  const { year, month } = getSPParts(d);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 00:00 SP de cada dia entre `from` (inclusive) e `to` (exclusivo).
// Cada Date retornado tem hora 03:00 UTC (= 00:00 SP do mesmo dia).
export function* daysBetweenSP(from: Date, to: Date): Generator<Date> {
  const cur = new Date(from.getTime());
  while (cur < to) {
    yield new Date(cur.getTime());
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

// Final do dia em SP (23:59:59.999) → em UTC é 02:59:59.999 do dia seguinte
export function endOfDaySP(d: Date = new Date()): Date {
  const { year, month, day } = getSPParts(d);
  return new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999));
}

// Valida e normaliza uma chave de mês "YYYY-MM". Retorna null se inválida.
export function parseMonthKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return null;
  return raw;
}

// "YYYY-MM" → 00:00 SP do dia 1 desse mês (03:00 UTC)
export function startOfMonthFromKey(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 3, 0, 0, 0));
}

// "YYYY-MM" → 00:00 SP do dia 1 do mês seguinte (limite exclusivo)
export function endOfMonthFromKey(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1, 3, 0, 0, 0));
}
