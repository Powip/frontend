"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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
  const { storeIds, canFetch } = useDashboardScope();
  const panelKey = JSON.stringify([auth?.company?.id, auth?.user.id, pathname]);

  return (
    <>
      {canFetch ? <Fragment key={panelKey}>{children}</Fragment> : (
        <p role="status" className="p-6 text-sm text-muted-foreground">
          {auth?.accessToken && storeIds.length === 0 ? "No hay tiendas disponibles para este reporte." : "Cargando sesión…"}
        </p>
      )}
    </>
  );
}
