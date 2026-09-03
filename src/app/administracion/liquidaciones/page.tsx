"use client";

/**
 * Liquidaciones — courier — §13 doc técnica.
 *
 * CONECTADO A DATOS REALES: pedidos ENTREGADO reales con courier asignado,
 * agrupados por courier (`agruparPorCourier` en `_lib/realData.ts`), mismo
 * criterio que `operaciones/liquidaciones/_components/utils.ts` (recaudado
 * = grandTotal, adelantos = pagos PAID, neto = recaudado − adelantos).
 *
 * SOLUCIÓN PUENTE (localStorage, sin backend): "Confirmar" guarda qué
 * courier ya se liquidó y CUÁNDO en este dispositivo
 * (`useLiquidacionesConfirmadas`, `_lib/liquidacionesStorage.ts`) — no hay
 * endpoint en ms-courier que registre el cobro todavía (ver
 * `src/components/finanzas/BACKEND_REQUERIMIENTOS.md`, ninguno de esos 8
 * endpoints existe), así que esto no se sincroniza entre usuarios ni
 * dispositivos. Guardar la fecha (no solo el nombre) es a propósito: el
 * corte excluye pedidos ya cubiertos por esa confirmación, pero el courier
 * vuelve a aparecer si acumula un saldo nuevo después — confirmar por nombre
 * nada más lo hubiera ocultado para siempre.
 *
 * OCULTO — Vendedoras: no existe ningún concepto de meta/comisión/escala
 * por vendedor en ningún microservicio (a diferencia de todo lo demás en
 * este archivo, acá no hay ni una fuente real de la que partir), así que la
 * sub-pestaña se sacó de la UI en vez de mostrar datos de ejemplo como si
 * fueran reales. Vuelve a agregarse cuando exista esa entidad en backend.
 *
 * El desglose "envío" / "devolución" por courier (que sí traía el mockup)
 * tampoco es derivable de OrderHeader — solo se puede calcular recaudado,
 * adelantos y neto.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersByCompany } from "@/api/Ventas";
import { agruparPorCourier } from "../_lib/realData";
import { useLiquidacionesConfirmadas, useCutoffPorCourier } from "../_lib/liquidacionesStorage";
import { fmtMoney } from "../_lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check } from "lucide-react";

const STALE = 5 * 60 * 1000;

export default function LiquidacionesPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const [confirmadosArr, setConfirmadosArr] = useLiquidacionesConfirmadas(companyId);
  const cutoffPorCourier = useCutoffPorCourier(confirmadosArr);

  const hoy = new Date();
  const desde = format(subDays(hoy, 60), "yyyy-MM-dd");
  const hasta = format(hoy, "yyyy-MM-dd");
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-liquidaciones-orders", companyId, desde, hasta],
    queryFn: () => getOrdersByCompany(companyId, desde, hasta),
    enabled: !!companyId,
    staleTime: STALE,
  });

  const couriers = useMemo(
    () => agruparPorCourier(orders as any[], cutoffPorCourier),
    [orders, cutoffPorCourier],
  );

  function confirmarCourier(nombre: string, neto: number) {
    setConfirmadosArr((prev) => [...prev, { courier: nombre, confirmadoEn: new Date().toISOString() }]);
    toast.success(`Liquidación confirmada · ${fmtMoney(neto)} · guardado en este dispositivo`);
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold">Liquidaciones</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Courier — pedidos reales de los últimos 60 días</p>
      </div>

      <div className="rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3.5 text-sm text-blue-800 dark:text-blue-300">
        ℹ️ El courier tiene 2 roles: <b>transportista</b> (cobras por guía = egreso) y <b>recaudador COD</b> (retiene efectivo, liquida semanalmente). Acá ves cuánto te debe cada courier.
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <Card>
          <CardContent className="pt-5 space-y-3">
            {couriers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin liquidaciones pendientes en los últimos 60 días.</p>
            ) : couriers.map((c) => (
              <div key={c.nombre} className="flex items-center gap-3 rounded-lg border p-3.5">
                <span className="text-xl w-8 text-center shrink-0">📦</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.diasMax > 15 ? `🔴 hasta ${c.diasMax} días sin liquidar` : `⚠️ hasta ${c.diasMax} días`} · {c.guias} guías · recaudado {fmtMoney(c.recaudado)} · adelantos {fmtMoney(c.adelantos)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold font-mono text-emerald-600">{fmtMoney(c.neto)}</p>
                  <p className="text-[10px] text-muted-foreground">neto a cobrar</p>
                  <Button size="sm" variant={c.diasMax > 15 ? "default" : "outline"} className="mt-1 h-7 text-xs" onClick={() => confirmarCourier(c.nombre, c.neto)}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Confirmar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
