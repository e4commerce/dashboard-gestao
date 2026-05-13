import Image from "next/image";
import Link from "next/link";
import {
  Target,
  TrendingUp,
  Activity,
  Database,
  Plug,
} from "lucide-react";
import { NavItem } from "./nav-item";
import { NavItemCompact } from "./nav-item-compact";
import { SyncIndicator } from "./sync-indicator";

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-2 border-r border-border-default bg-surface-sidebar px-3 py-6">
      <Link
        href="/visao-geral"
        aria-label="Visão geral"
        className="flex items-center justify-center px-1 py-2 transition-opacity hover:opacity-80"
      >
        <Image
          src="/tipografia-branco@4x.png"
          alt="Murano"
          width={3169}
          height={782}
          priority
          className="h-auto w-full max-w-[72px]"
        />
      </Link>
      <nav className="my-auto flex flex-col gap-1">
        <NavItem
          href="/metas"
          label="Metas"
          icon={<Target strokeWidth={1.75} />}
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
      </nav>
      <div className="flex flex-col gap-3">
        <NavItemCompact
          href="/dados"
          label="Dados"
          icon={<Database strokeWidth={1.75} />}
        />
        <NavItemCompact
          href="/integracoes"
          label="Integrações"
          icon={<Plug strokeWidth={1.75} />}
        />
        <SyncIndicator />
      </div>
    </aside>
  );
}
