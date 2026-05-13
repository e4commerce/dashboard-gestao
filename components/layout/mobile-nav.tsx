"use client";

import {
  BarChart3,
  Target,
  TrendingUp,
  Activity,
  Database,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/visao-geral", label: "Geral", icon: BarChart3 },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/analise-margem", label: "Margem", icon: TrendingUp },
  { href: "/performance", label: "Perf.", icon: Activity },
  { href: "/dados", label: "Dados", icon: Database },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border-default bg-surface-sidebar md:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
              isActive ? "text-fg-primary" : "text-fg-muted",
            )}
          >
            <Icon
              className={cn("size-5", isActive ? "opacity-100" : "opacity-60")}
              strokeWidth={1.75}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
