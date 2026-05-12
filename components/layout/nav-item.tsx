"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  icon: ReactNode;
};

export function NavItem({ href, label, icon }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-md px-2 py-2.5 text-xs leading-tight transition-colors",
        isActive
          ? "bg-action-ghost-active text-fg-primary"
          : "text-fg-muted hover:bg-surface-card-hover hover:text-fg-primary",
      )}
    >
      <span className="flex size-5 items-center justify-center text-current [&_svg]:size-5">
        {icon}
      </span>
      <span className="text-center">{label}</span>
    </Link>
  );
}
