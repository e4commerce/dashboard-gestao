import type { Sector } from "@/lib/mock-data";
import { MetricRow } from "./metric-row";

type Props = {
  sector: Sector;
};

export function SectorCard({ sector }: Props) {
  return (
    <article className="rounded-lg border border-border-default bg-surface-card p-6">
      <h3 className="mb-2 text-base font-semibold text-fg-primary">
        {sector.title}
      </h3>
      <div className="divide-y divide-border-subtle">
        {sector.metrics.map((m) => (
          <MetricRow key={m.label} metric={m} />
        ))}
      </div>
    </article>
  );
}
