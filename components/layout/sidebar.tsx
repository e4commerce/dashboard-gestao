import {
  BarChart3,
  Target,
  Database,
  Route,
  Wallet,
  Megaphone,
  TrendingUp,
  Activity,
} from "lucide-react";
import { NavItem } from "./nav-item";
import { SyncIndicator } from "./sync-indicator";

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-2 border-r border-border-default bg-surface-sidebar px-3 py-6">
      <nav className="flex flex-col gap-1">
        <NavItem
          href="/visao-geral"
          label="Visão Geral"
          icon={<BarChart3 strokeWidth={1.75} />}
        />
        <NavItem
          href="/metas"
          label="Metas"
          icon={<Target strokeWidth={1.75} />}
        />
        <NavItem
          href="/jornada"
          label="Jornada"
          icon={<Route strokeWidth={1.75} />}
        />
        <NavItem
          href="/custos"
          label="Custos"
          icon={<Wallet strokeWidth={1.75} />}
        />
        <NavItem
          href="/marketing"
          label="Marketing"
          icon={<Megaphone strokeWidth={1.75} />}
        />
        <NavItem
          href="/analise-margem"
          label="Análise de Margem"
          icon={<TrendingUp strokeWidth={1.75} />}
        />
        <NavItem
          href="/performance"
          label="Análise de Performance"
          icon={<Activity strokeWidth={1.75} />}
        />
        <NavItem
          href="/extracoes"
          label="Extrações"
          icon={<Database strokeWidth={1.75} />}
        />
      </nav>
      <div className="mt-auto">
        <SyncIndicator />
      </div>
    </aside>
  );
}
