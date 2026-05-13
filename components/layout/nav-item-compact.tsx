"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  label: string;
  icon: ReactNode;
};

// Variante reduzida da NavItem — usada no rodapé da sidebar pra itens
// secundários (Integrações, etc). Ícone menor, opacidade reduzida.
export function NavItemCompact({ href, label, icon }: Props) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[10px] leading-tight transition-opacity",
        isActive
          ? "text-fg-primary opacity-100"
          : "text-fg-muted opacity-50 hover:opacity-100",
      )}
    >
      <span className="flex size-4 items-center justify-center text-current [&_svg]:size-4">
        {icon}
      </span>
      <span className="text-center">{label}</span>
    </Link>
  );
}
