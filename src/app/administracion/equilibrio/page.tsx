"use client";

/**
 * Punto de Equilibrio.
 *
 * Costos fijos y costo variable por unidad se auto-calculan desde la misma
 * cascada real que usan Resumen y Utilidad & Margen (`_lib/pnl.ts`):
 * - Costos fijos = `totalGastosOperativos` (gastos por categoría + fees
 *   marketplace + courier integrado) — antes solo sumaba los gastos
 *   manuales, sin fees ni courier.
 * - Costo variable por unidad = (COGS + merma) ÷ unidades entregadas — antes
 *   solo consideraba COGS.
 * Los 3 valores quedan editables (el usuario puede ajustar si lo necesita),
 * pero arrancan con el número real en vez de en 0.
 */

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(n: number) { return `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 0 })}`; }

export default function EquilibrioPage() {
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

  const totalUnidades = useMemo(
    () => (orders as any[]).filter((o) => o.status === "ENTREGADO").reduce((s: number, o: any) => s + (o.itemCount || 1), 0),
    [orders],
  );

  const [costosFijos, setCostosFijos] = useState(0);
  const [precioPromedio, setPrecioPromedio] = useState(0);
  const [costoVariableUnit, setCostoVariableUnit] = useState(0);

  useEffect(() => {
    if (!pnl) return;
    setCostosFijos(pnl.totalGastosOperativos);
    setPrecioPromedio(totalUnidades > 0 ? pnl.ventasBrutas / totalUnidades : 0);
    setCostoVariableUnit(totalUnidades > 0 ? (pnl.cogs + pnl.mermaCosto) / totalUnidades : 0);
  }, [pnl, totalUnidades]);

  const margenContribucion = precioPromedio - costoVariableUnit;
  const puntoEquilibrioUnidades = margenContribucion > 0 ? Math.ceil(costosFijos / margenContribucion) : 0;
  const puntoEquilibrioSoles = puntoEquilibrioUnidades * precioPromedio;

  if (loading) return <div className="p-8 space-y-4">{Array.from({length:2}).map((_,i)=><Skeleton key={i} className="h-40"/>)}</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Costos Fijos del mes", value: costosFijos, setter: setCostosFijos, hint: "Gastos operativos + fees marketplace + courier integrado" },
          { label: "Precio promedio por unidad", value: precioPromedio, setter: setPrecioPromedio, hint: "Calculado desde ventas entregadas" },
          { label: "Costo variable por unidad", value: costoVariableUnit, setter: setCostoVariableUnit, hint: "COGS + merma, calculado desde pedidos" },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</CardTitle></CardHeader>
            <CardContent>
              <Label className="text-xs">{item.hint}</Label>
              <Input type="number" className="font-mono mt-1" value={item.value.toFixed(2)} onChange={(e) => item.setter(Number(e.target.value))} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Margen de contribución", valor: fmt(margenContribucion), sub: "por unidad" },
          { label: "Punto de equilibrio", valor: `${puntoEquilibrioUnidades} uds.`, sub: "para cubrir costos fijos" },
          { label: "Ventas mínimas necesarias", valor: fmt(puntoEquilibrioSoles), sub: "para no perder dinero" },
        ].map((item) => (
          <Card key={item.label} className="bg-primary/5 border-primary/20">
            <CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold font-mono text-primary">{item.valor}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
