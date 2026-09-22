"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Resumen", href: "/partners" },
  { label: "Mis Referidos", href: "/partners/referidos" },
  { label: "Comisiones", href: "/partners/comisiones" },
  { label: "Pagos", href: "/partners/pagos" },
  { label: "Mi Link", href: "/partners/link" },
  { label: "Mi Plan", href: "/partners/plan" },
];

export function PartnersTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de Partners"
      className="flex overflow-x-auto border-b border-border bg-background px-8"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors",
              isActive
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
