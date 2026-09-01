"use client";

/**
 * Flujo de Caja vs P&L y adelantos COD — §12 doc técnica.
 *
 * CONECTADO A DATOS REALES: Ventas entregadas, COGS, gastos fijos y costo de
 * courier por mes salen de `useAdminYearPnl` (`_lib/useMonthlyPnl.ts`),
 * agregando pedidos/gastos reales del año en curso. Adelantos pendientes
 * hoy = suma de pagos PAID en pedidos que todavía no llegan a ENTREGADO
 * (mismo criterio que `operaciones/liquidaciones`).
 *
 * SIGUE MOCK / SIN DATO REAL:
 * - Publicidad: sin fuente real (ver Pauta por canal), se muestra en 0.
 * - El concepto central del doc —`adelantos_pendientes` como pasivo que se
 *   revierte si el pedido NO_ENTREGADO/CANCELADO— no se puede modelar
 *   históricamente mes a mes: `OrderStatus` no distingue esos estados de
 *   `ANULADO`, y no hay ledger persistente. Por eso "Adelantos" se muestra
 *   como una foto de HOY, no como fila mensual del histórico.
 * - IGV/IR estimado, comisión POWIP y merma no están incluidos en el profit
 *   mensual de esta vista (sí lo están en Resumen/Gastos) — para no sumar
 *   ~12 llamadas más a `getShrinkageSummary` por carga de página.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersByCompany } from "@/api/Ventas";
import { useAdminYearPnl } from "../_lib/useMonthlyPnl";
import { paidAmount } from "../_lib/realData";
import { MESES_CORTOS } from "../_mock/data";
import { fmtMoney } from "../_lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STALE = 5 * 60 * 1000;

export default function FlujoDeCajaPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const token = auth?.accessToken ?? "";
  const storeIds = useMemo(() => (auth?.company?.stores ?? []).map((s) => s.id), [auth?.company?.stores]);
  const anio = new Date().getFullYear();

  const { meses, isLoading: loadingPnl } = useAdminYearPnl(companyId, anio, storeIds, token);

  const hoy = new Date();
  const desde = format(subDays(hoy, 45), "yyyy-MM-dd");
  const hasta = format(hoy, "yyyy-MM-dd");
  const { data: ordersRecientes = [], isLoading: loadingAdelantos } = useQuery({
    queryKey: ["admin-flujo-adelantos", companyId, desde, hasta],
    queryFn: () => getOrdersByCompany(companyId, desde, hasta),
    enabled: !!companyId,
    staleTime: STALE,
  });

  const adelantosHoy = useMemo(() => {
    return (ordersRecientes as any[])
      .filter((o) => o.status !== "ENTREGADO" && o.status !== "ANULADO")
      .reduce((sum, o) => sum + paidAmount(o), 0);
  }, [ordersRecientes]);

  const pedidosConAdelanto = useMemo(
    () => (ordersRecientes as any[]).filter((o) => o.status !== "ENTREGADO" && o.status !== "ANULADO" && paidAmount(o) > 0).length,
    [ordersRecientes],
  );

  const ingresos = meses.map((m) => m.ventas);
  const totalIngresos = ingresos;
  const egresosFijos = meses.map((m) => m.gastosFijos);
  const egresosCourier = meses.map((m) => m.courierCost);
  const egresosCogs = meses.map((m) => m.cogs);
  const totalEgresos = meses.map((m) => m.gastosFijos + m.courierCost + m.cogs);
  const flujoNeto = meses.map((m, i) => totalIngresos[i] - totalEgresos[i]);

  const loading = loadingPnl || loadingAdelantos;
  if (loading) {
    return <div className="p-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold">Flujo de Caja</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Ventas entregadas, COGS y gastos reales por mes — {anio}</p>
      </div>

      <div className="rounded-lg border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
        ⚠️ Esta tabla no incluye publicidad (sin conectar), ni IGV/comisión POWIP/merma mes a mes (sí están en Resumen y Gastos). Es un flujo simplificado.
      </div>

      <Card className="bg-amber-50/40 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20">
        <CardHeader><CardTitle className="text-sm">💰 Adelantos pendientes — hoy</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-background rounded-lg border p-3.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Adelantos pendientes de entregar</p>
              <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">{fmtMoney(adelantosHoy)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cobrado, pero el pedido aún no está ENTREGADO</p>
            </div>
            <div className="bg-background rounded-lg border p-3.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Pedidos con adelanto</p>
              <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">{pedidosConAdelanto}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Últimos 45 días</p>
            </div>
          </div>
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3 text-xs text-blue-800 dark:text-blue-300 mt-4">
            ℹ️ Foto de hoy, no histórico mensual — no hay ledger de adelantos persistente todavía.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Flujo {anio} — Ingresos vs Egresos (real)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                {MESES_CORTOS.map((m, i) => <TableHead key={m} className={cn("text-right", meses[i].mes === hoy.getMonth() + 1 && "text-primary")}>{m}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/60"><TableCell colSpan={13} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Ingresos</TableCell></TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Ventas entregadas</TableCell>
                {ingresos.map((v, i) => <TableCell key={i} className={cn("text-right font-mono", v > 0 && "text-emerald-600")}>{v === 0 ? "—" : fmtMoney(v)}</TableCell>)}
              </TableRow>
              <TableRow className="bg-muted/40 font-bold">
                <TableCell>TOTAL INGRESOS</TableCell>
                {totalIngresos.map((v, i) => <TableCell key={i} className="text-right font-mono text-emerald-600">{v === 0 ? "—" : fmtMoney(v)}</TableCell>)}
              </TableRow>

              <TableRow className="bg-muted/60"><TableCell colSpan={13} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Egresos</TableCell></TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">COGS</TableCell>
                {egresosCogs.map((v, i) => <TableCell key={i} className={cn("text-right font-mono", v > 0 && "text-destructive")}>{v === 0 ? "—" : fmtMoney(v)}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Gastos fijos + operativos</TableCell>
                {egresosFijos.map((v, i) => <TableCell key={i} className={cn("text-right font-mono", v > 0 && "text-destructive")}>{v === 0 ? "—" : fmtMoney(v)}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Courier integrado</TableCell>
                {egresosCourier.map((v, i) => <TableCell key={i} className={cn("text-right font-mono", v > 0 && "text-destructive")}>{v === 0 ? "—" : fmtMoney(v)}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Publicidad</TableCell>
                {MESES_CORTOS.map((_, i) => <TableCell key={i} className="text-right font-mono text-muted-foreground">sin conectar</TableCell>)}
              </TableRow>
              <TableRow className="bg-muted/40 font-bold">
                <TableCell>TOTAL EGRESOS</TableCell>
                {totalEgresos.map((v, i) => <TableCell key={i} className="text-right font-mono text-destructive">{v === 0 ? "—" : fmtMoney(v)}</TableCell>)}
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow className="bg-primary text-primary-foreground font-bold">
                <TableCell>FLUJO NETO</TableCell>
                {flujoNeto.map((v, i) => <TableCell key={i} className={cn("text-right font-mono", v < 0 && "text-red-200")}>{meses[i].tieneDatos ? fmtMoney(v) : "—"}</TableCell>)}
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
