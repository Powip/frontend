"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardScopeProvider, useDashboardScope, type DashboardScope } from "@/contexts/DashboardScopeContext";
import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function MetricsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/metricas/superadmin") return children;
  return <DashboardScopeProvider><ScopedMetrics>{children}</ScopedMetrics></DashboardScopeProvider>;
}

function ScopedMetrics({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { auth, selectedStoreId } = useAuth();
  const { scope, setScope, storeIds, canFetch } = useDashboardScope();
  const canViewBusiness = hasAdminAccess(auth?.user.role) || isSuperadmin(auth?.user.email);
  const selectedStore = auth?.company?.stores?.find((store) => store.id === selectedStoreId);
  const panelKey = JSON.stringify([auth?.company?.id, auth?.user.id, pathname]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
        <p className="text-sm text-muted-foreground">{scope === "business" ? "Todas las tiendas del negocio" : "Tienda seleccionada"}</p>
        {canViewBusiness && (
          <Select value={scope} onValueChange={(value) => setScope(value as DashboardScope)}>
            <SelectTrigger aria-label="Alcance del reporte" className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="business">Todo el negocio</SelectItem>
              <SelectItem value="store">{selectedStore?.name ?? "Tienda seleccionada"}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      {canFetch ? <Fragment key={panelKey}>{children}</Fragment> : (
        <p role="status" className="p-6 text-sm text-muted-foreground">
          {auth?.accessToken && storeIds.length === 0 ? "No hay tiendas disponibles para este reporte." : "Cargando sesión…"}
        </p>
      )}
    </>
  );
}
