"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {ReportCurrencySelector} from "@/components/dashboard/ReportCurrencySelector";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";

export default function MetricsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/metricas/superadmin") return children;
  return <ScopedMetrics>{children}</ScopedMetrics>;
}

function ScopedMetrics({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const { storeIds, canFetch, scope, scopeParams } = useDashboardScope();
  const panelKey = JSON.stringify([auth?.company?.id, auth?.user.id, auth?.user.permissions, pathname, scopeParams]);

  return (
    <>
      {pathname !== "/metricas/leads" && <div className="px-6 pt-4"><ReportCurrencySelector /></div>}
      {pathname !== "/metricas/leads" && auth?.user.permissions?.some(permission=>["VIEW_LEADS","MANAGE_LEADS"].includes(permission)) && <p className="px-6 pt-3 text-sm text-muted-foreground">Las oportunidades se consultan en <Link href="/metricas/leads" className="underline">Reporte de Leads</Link>.</p>}
      {canFetch || (pathname === "/metricas/leads" && scope === "business" && auth?.company?.id && auth?.user.id) ? <Fragment key={panelKey}>{children}</Fragment> : (
        <p role="status" className="p-6 text-sm text-muted-foreground">
          {auth?.accessToken && storeIds.length === 0 ? "No hay tiendas disponibles para este reporte." : "Cargando sesión…"}
        </p>
      )}
    </>
  );
}
