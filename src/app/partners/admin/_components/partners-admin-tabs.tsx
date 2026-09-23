"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useReviewQueue } from "@/features/partners/hooks/use-review-queue";

const TABS = [
  { label: "Dashboard", href: "/partners/admin" },
  { label: "Partners", href: "/partners/admin/partners" },
  { label: "Cola de referidos", href: "/partners/admin/cola" },
  { label: "Liquidaciones", href: "/partners/admin/liquidaciones" },
  { label: "Reglas & Comisiones", href: "/partners/admin/reglas" },
  { label: "Casuística", href: "/partners/admin/casuistica" },
];

export function PartnersAdminTabs() {
  const pathname = usePathname();
  const queueQuery = useReviewQueue();
  const pendingCount = queueQuery.data?.filter((item) => item.resolution === "pendiente").length ?? 0;

  return (
    <nav
      aria-label="Secciones de administración de Partners"
      className="flex overflow-x-auto border-b border-border bg-background px-8"
    >
      {TABS.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.href !== "/partners/admin" && pathname.startsWith(`${tab.href}/`));
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
            {tab.href === "/partners/admin/cola" && pendingCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
