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
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export function formatLongDate(date: Date): string {
  return date
    .toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .replace(/^./, (c) => c.toUpperCase());
}
