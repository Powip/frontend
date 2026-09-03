"use client";

/**
 * Utilidad & Margen.
 *
 * CONECTADO A DATOS REALES: usa la misma cascada de utilidad que Resumen
 * (`_lib/pnl.ts` → `calcularPnL`) — ventas, COGS, merma, fees marketplace,
 * courier integrado, gastos operativos por categoría, comisión POWIP e IGV
 * con la config real de la empresa (`auth.company.iva`,
 * `auth.company.powipCommissionRate`). Antes esta página tenía su propia
 * fórmula simplificada (sin merma/fees/courier, con comisión POWIP e IGV
 * hardcodeados en 0.5%/1.5% para todas las empresas) que divergía de Resumen
 * — quedó unificada acá.
 */

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import {
  useAdminOrders,
  useAdminGastos,
  useAdminShrinkageSummary,
  useAdminCourierCost,
} from "@/hooks/useAdminQueries";
import { IGastoOperativo } from "@/interfaces/IAdmin";
import { calcularPnL } from "../_lib/pnl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(n: number) { return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 0 })}`; }
function pct(n: number) { return `${n.toFixed(1)}%`; }

export default function UtilidadPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();

  const companyId = auth?.company?.id ?? "";
  const token = auth?.accessToken ?? "";
  const storeIds = useMemo(() => (auth?.company?.stores ?? []).map((s) => s.id), [auth?.company?.stores]);
  const ivaRate = (auth?.company?.iva ?? 18) / 100;
  const powipRate = auth?.company?.powipCommissionRate ?? 0.005;

  const { data: orders = [], isLoading: l1 } = useAdminOrders(companyId, fromDate, toDate);
  const { data: gastos = [], isLoading: l2 } = useAdminGastos(companyId, fromDate, toDate, token);
  const { data: merma, isLoading: l3 } = useAdminShrinkageSummary(companyId, fromDate, toDate, token);
  const { data: courierCost = 0, isLoading: l4 } = useAdminCourierCost(storeIds, fromDate, toDate, token);

  const loading = l1 || l2 || l3 || l4;

  const pnl = useMemo(() => {
    if (!merma) return null;
    return calcularPnL(orders as any[], gastos as IGastoOperativo[], merma, ivaRate, courierCost as number, powipRate);
  }, [orders, gastos, merma, courierCost, ivaRate, powipRate]);

  const categorias = useMemo(() => {
    if (!pnl) return [];
    const items = [
      { label: "Fees marketplace", monto: pnl.feesMarketplace },
      { label: "Courier integrado", monto: pnl.courierIntegrado },
      { label: "Merma de inventario", monto: pnl.mermaCosto },
      { label: "Personal / Planilla", monto: pnl.gastosPersonal },
      { label: "Herramientas + Oficina", monto: pnl.gastosHerramientas },
      { label: "Publicidad", monto: pnl.gastosMarketing },
      { label: "Courier Propio", monto: pnl.gastosCourierPropio },
      { label: "Otro", monto: pnl.gastosOtros },
    ];
    return items.map((it) => ({ ...it, pct: pnl.ventasBrutas > 0 ? (it.monto / pnl.ventasBrutas) * 100 : 0 }));
  }, [pnl]);

  if (loading) return <div className="p-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (!pnl) return null;

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Margen Bruto", valor: pnl.utilidadBruta, margen: pnl.margenBruto, color: "text-green-600" },
          { label: "Margen Operativo", valor: pnl.utilidadOperativa, margen: pnl.margenOperativo, color: "text-amber-600" },
          { label: "Margen Neto", valor: pnl.utilidadNeta, margen: pnl.margenNeto, color: "text-primary" },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold font-mono ${item.color}`}>{pct(item.margen)}</p>
              <p className="text-sm text-muted-foreground mt-1">{fmt(item.valor)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Desglose de costos y gastos (% sobre ventas)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {categorias.map((cat) => (
            <div key={cat.label} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-40">{cat.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(cat.pct, 100)}%` }} />
              </div>
              <span className="text-sm font-mono w-16 text-right">{pct(cat.pct)}</span>
              <span className="text-sm font-mono w-24 text-right text-muted-foreground">{fmt(cat.monto)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-3 text-sm font-semibold">
            <span>Comisión POWIP ({(powipRate * 100).toFixed(2)}%) + IGV/IR estimado ({(ivaRate * 100).toFixed(0)}%)</span>
            <span className="font-mono">{fmt(pnl.comisionPowip + pnl.igvEstimado)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
