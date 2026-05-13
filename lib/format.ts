export function formatBRL(value: number, fractionDigits = 0): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

export function formatCompactBRL(value: number): string {
  if (value >= 1000) {
    return `R$ ${Math.round(value / 1000)}k`;
  }
  return `R$ ${value}`;
}

export function formatDelta(delta: number): string {
  const pct = Math.abs(delta * 100);
  const formatted = pct.toLocaleString("pt-BR", {
    minimumFractionDigits: pct >= 10 || Number.isInteger(pct) ? 0 : 1,
    maximumFractionDigits: 1,
  });
  return `${formatted}%`;
}

// Datas exibidas são sempre formatadas no fuso de São Paulo, para refletir o
// calendário local do usuário independente do navegador/servidor.
const SP_TZ = "America/Sao_Paulo";

export function formatDateLabel(iso: string): string {
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value);
  return `${get("day")} ${months[get("month") - 1]}`;
}

export function formatLongDate(date: Date): string {
  return date
    .toLocaleDateString("pt-BR", {
      timeZone: SP_TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .replace(/^./, (c) => c.toUpperCase());
}

// "DD/MM/YY HH:MM" no fuso SP — para timestamps de logs/sincronizações.
export function formatDateTimeSP(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", {
    timeZone: SP_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "DD/MM/YYYY" no fuso SP — para datas sem hora.
export function formatDateBR(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", { timeZone: SP_TZ });
}
