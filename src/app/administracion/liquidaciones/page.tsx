"use client";

/**
 * Liquidaciones — courier y vendedoras — §13 doc técnica.
 *
 * CONECTADO A DATOS REALES (courier): pedidos ENTREGADO reales con courier
 * asignado, agrupados por courier (`agruparPorCourier` en `_lib/realData.ts`),
 * mismo criterio que `operaciones/liquidaciones/_components/utils.ts`
 * (recaudado = grandTotal, adelantos = pagos PAID, neto = recaudado −
 * adelantos). "Confirmar" solo saca la fila de la vista en esta sesión — no
 * hay endpoint en ms-courier que registre el cobro todavía (ver
 * `src/components/finanzas/BACKEND_REQUERIMIENTOS.md`, ninguno de esos 8
 * endpoints existe).
 *
 * SIGUE MOCK / SIN DATO REAL:
 * - Vendedoras: no existe ningún concepto de meta/comisión/escala por
 *   vendedor en ningún microservicio — toda la sección sigue en
 *   `_mock/data.ts`.
 * - El desglose "envío" / "devolución" por courier (que sí traía el mockup)
 *   no es derivable de OrderHeader — solo se puede calcular recaudado,
 *   adelantos y neto.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersByCompany } from "@/api/Ventas";
import { agruparPorCourier } from "../_lib/realData";
import { VENDEDORAS_MOCK, type VendedoraMock } from "../_mock/data";
import { fmtMoney } from "../_lib/format";
import { NivelPill } from "../_components/nivel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check } from "lucide-react";

type SubTab = "courier" | "vendedoras";
const STALE = 5 * 60 * 1000;

export default function LiquidacionesPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const [tab, setTab] = useState<SubTab>("courier");
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());
  const [vendedoras, setVendedoras] = useState<VendedoraMock[]>(VENDEDORAS_MOCK);

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
    () => agruparPorCourier(orders as any[]).filter((c) => !confirmados.has(c.nombre)),
    [orders, confirmados],
  );

  function confirmarCourier(nombre: string, neto: number) {
    setConfirmados((prev) => new Set(prev).add(nombre));
    toast.success(`Liquidación confirmada · ${fmtMoney(neto)} (no persiste — no hay endpoint en ms-courier todavía)`);
  }

  function pagarVendedora(id: string) {
    const v = vendedoras.find((x) => x.id === id);
    if (!v) return;
    setVendedoras((prev) => prev.map((x) => (x.id === id ? { ...x, estado: "pagado" } : x)));
    toast.success(`Comisión pagada · ${fmtMoney(v.total)} (dato de ejemplo, sin entidad real)`);
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold">Liquidaciones</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Courier: pedidos reales · Vendedoras: sin datos, ejemplo</p>
      </div>

      <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
        <button onClick={() => setTab("courier")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", tab === "courier" ? "bg-background shadow-sm" : "text-muted-foreground")}>Courier</button>
        <button onClick={() => setTab("vendedoras")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", tab === "vendedoras" ? "bg-background shadow-sm" : "text-muted-foreground")}>Vendedoras</button>
      </div>

      {tab === "courier" ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3.5 text-sm text-blue-800 dark:text-blue-300">
            ℹ️ El courier tiene 2 roles: <b>transportista</b> (cobras por guía = egreso) y <b>recaudador COD</b> (retiene efectivo, liquida semanalmente). Acá ves cuánto te debe cada courier, calculado de pedidos reales de los últimos 60 días.
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
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 p-3.5 text-sm text-amber-800 dark:text-amber-300">
            ⚠️ No existe ninguna entidad de vendedoras/comisiones en el backend todavía — esta sección es 100% de ejemplo.
          </div>
          {vendedoras.map((v) => <VendedoraCard key={v.id} v={v} onPagar={() => pagarVendedora(v.id)} />)}
        </div>
      )}
    </div>
  );
}

function VendedoraCard({ v, onPagar }: { v: VendedoraMock; onPagar: () => void }) {
  const kpis = [
    ["Facturación", `S/ ${(v.facturacion / 1000).toFixed(0)}k`],
    ["Meta", `S/ ${(v.meta / 1000).toFixed(0)}k`],
    ["Cumpl.", `${((v.facturacion / v.meta) * 100).toFixed(0)}%`],
    ["Pedidos", String(v.pedidosRealizados)],
    ["Efect.", `${v.efectividad}%`],
    ["CPO", `S/ ${v.cpo}`],
    ["CPV", `S/ ${v.cpv}`],
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-xs shrink-0">{v.iniciales}</span>
          <div>
            <CardTitle className="text-sm">{v.nombre}</CardTitle>
            <p className="text-xs text-muted-foreground">Base S/ {v.base} + Bono S/ {v.bono}</p>
          </div>
        </div>
        <NivelPill nivel={v.estado === "alcanzado" ? "verde" : v.estado === "pagado" ? "azul" : "ambar"}>
          {v.estado === "alcanzado" ? "Meta alcanzada" : v.estado === "pagado" ? "Pagado" : "Parcial"}
        </NivelPill>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {kpis.map(([l, val]) => (
            <div key={l} className="text-center bg-muted/50 rounded-lg py-2 px-1">
              <p className="text-[9px] text-muted-foreground uppercase">{l}</p>
              <p className="text-sm font-bold mt-0.5">{val}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Escala de comisiones</p>
          <div className="space-y-1">
            {v.escala.map((e) => (
              <div key={e.umbral} className={cn("flex justify-between px-2.5 py-1.5 rounded-md text-xs", e.actual ? "bg-primary/10 font-semibold" : "")}>
                <span>{e.actual ? "●" : "○"} Cumplimiento {e.umbral} → Bono S/ {e.bono}</span>
                {e.actual && <span className="text-muted-foreground">Nivel actual</span>}
              </div>
            ))}
          </div>
        </div>
        <Button className="w-full" disabled={v.estado === "pagado"} onClick={onPagar}>
          {v.estado === "pagado" ? "✓ Pagado" : `Marcar pagado · ${fmtMoney(v.total)}`}
        </Button>
      </CardContent>
    </Card>
  );
}
