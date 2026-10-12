"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminDashboardSummary } from "@/features/partners/hooks/use-admin-dashboard-summary";
import { useAdminReadAccess } from "@/features/partners/hooks/use-admin-read-session";
import { AdminDashboardKpiRow } from "./admin-dashboard-kpi-row";
import { AdminReadAccessDenied, AdminReadError } from "./admin-read-error";

export function DashboardPageContent() {
  const access = useAdminReadAccess();
  const summaryQuery = useAdminDashboardSummary();
  if (access.denied)
    return (
      <div className="p-6">
        <AdminReadError
          error={access.denied}
          message="No pudimos verificar tu acceso a Partners."
        />
      </div>
    );
  if (!access.canView)
    return (
      <div className="p-6">
        <AdminReadAccessDenied />
      </div>
    );

  return (
    <div className="space-y-5 p-6">
      <h2 className="text-xl font-semibold">Dashboard operativo</h2>
      <Link href="/partners/admin/pagos-verificados" className="inline-block text-sm underline">
        Consultar evidencia de Billing · solo lectura
      </Link>
      {summaryQuery.isError ? (
        <AdminReadError
          message="No pudimos cargar el resumen del programa."
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
        />
      ) : (
        <>
          <AdminDashboardKpiRow summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />
          {summaryQuery.data ? (
            <p className="text-xs text-muted-foreground">
              Datos al {new Date(summaryQuery.data.asOf).toLocaleString("es-PE")}. Los referidos y
              las atribuciones LINK se cuentan por separado; una atribución no confirma un pago.
            </p>
          ) : null}
        </>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Métricas financieras</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="status" className="text-sm text-muted-foreground">
            Métricas monetarias todavía no disponibles: MRR, costo del canal, LTV y ROI. Los
            cálculos registrados y el libro contable se consultan por separado; no confirman
            liquidaciones ni pagos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
