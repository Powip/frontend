"use client";

/**
 * Reporte rápido — §16 doc técnica.
 *
 * CONECTADO A DATOS REALES: Venta total, Producto (COGS), Unidades, Pedidos
 * y Envíos (costo courier) salen de `getOrdersByCompany` / `getCourierCost`
 * (mismos endpoints que Resumen). Proyección de cierre de mes y el
 * simulador what-if usan esos mismos agregados reales como semilla.
 *
 * SIGUE MOCK / SIN DATO REAL:
 * - Publicidad y CPA: no existe ninguna entidad de inversión de pauta
 *   todavía (ver `administracion/pauta`) — se muestran en 0 con nota, y
 *   Ganancia se calcula SIN restar publicidad (para no inventar el número).
 * - ROAS: depende de publicidad, así que queda "—".
 * - Alertas: no existe un motor de alertas real (cuentas vencidas, tasa de
 *   confirmación, etc.) — sigue viniendo de `_mock/data.ts`, marcado en la UI.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, differenceInCalendarDays, getDaysInMonth } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersByCompany } from "@/api/Ventas";
import { getGastos, getCourierCost } from "@/api/Admin";
import { soloEntregados, fechaOrden } from "../_lib/realData";
import { ALERTAS_MOCK, type ReportePeriodo } from "../_mock/data";
import { fmtMoney, fmtNum, fmtPct } from "../_lib/format";
import { NivelDot } from "../_components/nivel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Share2, Copy } from "lucide-react";
import { toast } from "sonner";

const PERIODOS: { value: ReportePeriodo; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "quincena", label: "Quincena" },
  { value: "mes", label: "Mes" },
];

const STALE = 5 * 60 * 1000;

function rangoPeriodo(periodo: ReportePeriodo, hoy: Date) {
  const to = hoy;
  if (periodo === "hoy") return { from: hoy, to, label: `Hoy · ${format(hoy, "d MMM").toUpperCase()}` };
  if (periodo === "semana") return { from: subDays(hoy, 6), to, label: `Semana · últimos 7 días` };
  if (periodo === "quincena") return { from: subDays(hoy, 14), to, label: `Quincena · últimos 15 días` };
  const from = startOfMonth(hoy);
  return { from, to, label: `Mes · ${format(hoy, "MMMM yyyy").toUpperCase()}` };
}

export default function ReporteRapidoPage() {
  const { auth } = useAuth();
  const [periodo, setPeriodo] = useState<ReportePeriodo>("hoy");
  const [shareOpen, setShareOpen] = useState(false);

  const [deltaPrecio, setDeltaPrecio] = useState(0);
  const [deltaAds, setDeltaAds] = useState(0);
  const [tarifaCourier, setTarifaCourier] = useState(8);

  const companyId = auth?.company?.id ?? "";
  const token = auth?.accessToken ?? "";
  const storeIds = useMemo(() => (auth?.company?.stores ?? []).map((s) => s.id), [auth?.company?.stores]);

  const hoy = new Date();
  const ventana30d = format(subDays(hoy, 31), "yyyy-MM-dd");
  const hoyStr = format(hoy, "yyyy-MM-dd");

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["admin-reporte-orders", companyId],
    queryFn: () => getOrdersByCompany(companyId, ventana30d, hoyStr),
    enabled: !!companyId,
    staleTime: STALE,
  });

  const { data: gastosMes = [], isLoading: loadingGastos } = useQuery({
    queryKey: ["admin-reporte-gastos-mes", companyId, hoyStr],
    queryFn: () => getGastos(companyId, format(startOfMonth(hoy), "yyyy-MM-dd"), hoyStr, token),
    enabled: !!companyId && !!token,
    staleTime: STALE,
  });

  const { from, to, label } = rangoPeriodo(periodo, hoy);
  const fromStr = format(from, "yyyy-MM-dd");

  const { data: envios = 0, isLoading: loadingCourier } = useQuery({
    queryKey: ["admin-reporte-courier", storeIds.join(","), periodo, fromStr, hoyStr],
    queryFn: () => getCourierCost(storeIds, fromStr, hoyStr, token),
    enabled: storeIds.length > 0 && !!token,
    staleTime: STALE,
  });

  const loading = loadingOrders || loadingGastos || loadingCourier;

  const entregadosPeriodo = useMemo(
    () => soloEntregados(orders as any[]).filter((o) => fechaOrden(o) >= from && fechaOrden(o) <= to),
    [orders, from, to],
  );

  const data = useMemo(() => {
    const ventaTotal = entregadosPeriodo.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
    const producto = entregadosPeriodo.reduce((s, o) => s + Number(o.costAmount || 0), 0);
    const unidades = entregadosPeriodo.reduce((s, o) => s + (o.itemCount || (Array.isArray(o.items) ? o.items.length : 1)), 0);
    const pedidos = entregadosPeriodo.length;
    return { ventaTotal, producto, unidades, pedidos, envios: Number(envios) || 0 };
  }, [entregadosPeriodo, envios]);

  const ganancia = data.ventaTotal - data.producto - data.envios;

  const entregadosMes = useMemo(
    () => soloEntregados(orders as any[]).filter((o) => fechaOrden(o) >= startOfMonth(hoy)),
    [orders, hoy],
  );
  const diasTranscurridos = Math.max(1, differenceInCalendarDays(hoy, startOfMonth(hoy)) + 1);
  const diasDelMes = getDaysInMonth(hoy);
  const ventaMes = entregadosMes.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
  const productoMes = entregadosMes.reduce((s, o) => s + Number(o.costAmount || 0), 0);
  const unidadesMes = entregadosMes.reduce((s, o) => s + (o.itemCount || (Array.isArray(o.items) ? o.items.length : 1)), 0);
  const gastosFijosMes = (gastosMes as any[]).reduce((s, g) => s + Number(g.monto || 0), 0);

  const proyeccion = useMemo(() => {
    const estVentas = Math.round((ventaMes / diasTranscurridos) * diasDelMes);
    const estGanancia = Math.round(((ventaMes - productoMes) / diasTranscurridos) * diasDelMes);
    const estUnidades = Math.round((unidadesMes / diasTranscurridos) * diasDelMes);
    return { estVentas, estGanancia, estUnidades };
  }, [ventaMes, productoMes, unidadesMes, diasTranscurridos, diasDelMes]);

  const precioNetoProm = unidadesMes > 0 ? ventaMes / unidadesMes : 0;
  const cogsProm = unidadesMes > 0 ? productoMes / unidadesMes : 0;

  const sim = useMemo(() => {
    const precio = precioNetoProm * (1 + deltaPrecio / 100);
    const mc = precio - cogsProm - tarifaCourier;
    const pe = mc > 0 && gastosFijosMes > 0 ? Math.ceil(gastosFijosMes / mc) : null;
    const unidades = Math.round(unidadesMes * (1 + (deltaAds / 100) * 0.4));
    const ventas = Math.round(unidades * precio);
    const gananciaSim = Math.round(ventas - unidades * cogsProm - unidades * tarifaCourier - gastosFijosMes);
    return { mc, pe, ventas, gananciaSim };
  }, [precioNetoProm, cogsProm, tarifaCourier, deltaPrecio, deltaAds, unidadesMes, gastosFijosMes]);

  const shareText = `📊 REPORTE ${label.toUpperCase()}\n\nVenta total: ${fmtMoney(data.ventaTotal)}\nProducto: ${fmtMoney(data.producto)}\nEnvíos: ${fmtMoney(data.envios)}\nGANANCIA (sin publicidad, no conectada): ${fmtMoney(ganancia)}\n\nUnidades: ${data.unidades} · Pedidos: ${data.pedidos}\n— vía POWIP`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Reporte copiado · pégalo en WhatsApp");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (loading) {
    return (
      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Lo que compartes a diario</p>
          <h2 className="text-lg font-bold mt-0.5">Reporte rápido</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
            {PERIODOS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  periodo === p.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4 mr-1.5" /> Compartir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="border-2">
            <CardContent className="pt-5">
              <div className="font-bold text-sm tracking-wide border-b-2 border-foreground pb-2 mb-1">{label.toUpperCase()}</div>
              <ReporteRow label="VENTA TOTAL" valor={fmtMoney(data.ventaTotal)} bold />
              <ReporteRow label="PRODUCTO" valor={fmtMoney(data.producto)} />
              <ReporteRow label="PUBLICIDAD" valor="Sin conectar" muted />
              <ReporteRow label="ENVÍOS" valor={fmtMoney(data.envios)} />
              <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold px-4 py-3 rounded-b-lg -mx-6 -mb-6 mt-2">
                <span>GANANCIA <span className="font-normal text-[10px] opacity-80">(sin publicidad)</span></span>
                <span className="font-mono">{fmtMoney(ganancia)}</span>
              </div>
              <div className="flex gap-4 mt-6 text-xs text-muted-foreground">
                <span>Unidades: <b className="text-foreground">{fmtNum(data.unidades)}</b></span>
                <span>Pedidos: <b className="text-foreground">{fmtNum(data.pedidos)}</b></span>
                <span>ROAS: <b className="text-foreground">—</b></span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📈 Proyección a cerrar el mes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-3 text-center">
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Total ingresos (proy.)</p>
                  <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">{fmtMoney(proyeccion.estVentas)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 text-center">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Unidades (proy.)</p>
                  <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300">{fmtNum(proyeccion.estUnidades)}</p>
                </div>
              </div>
              {gastosFijosMes > 0 && (
                <Progress value={Math.min(100, (proyeccion.estVentas / (gastosFijosMes * 4)) * 100)} />
              )}
              <p className="text-xs text-muted-foreground">
                Al ritmo actual ({diasTranscurridos}/{diasDelMes} días) cierras en <b className="text-foreground">{fmtMoney(proyeccion.estVentas)}</b> · ganancia proyectada{" "}
                <b className="text-emerald-600">{fmtMoney(proyeccion.estGanancia)}</b> (sin publicidad — sin conectar). No hay meta de ventas configurada todavía (ver Resumen Anual).
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">🔔 Alertas — atiende esto hoy <span className="text-xs font-normal text-muted-foreground">(ejemplo, sin motor real todavía)</span></CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {ALERTAS_MOCK.map((a, i) => (
                <div key={i} className="flex gap-2.5 py-2.5 border-b last:border-0 text-sm">
                  <NivelDot nivel={a.nivel} className="mt-1.5" />
                  <span>{a.texto}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                🧮 Simulador · ¿qué pasa si…?{" "}
                <span className="text-xs font-normal text-muted-foreground">precio/COGS/unidades del mes en curso, reales</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Precio de venta <b>{deltaPrecio > 0 ? "+" : ""}{deltaPrecio}%</b>
                </Label>
                <input type="range" min={-20} max={20} step={1} value={deltaPrecio} onChange={(e) => setDeltaPrecio(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Unidades vía ADS <b>{deltaAds > 0 ? "+" : ""}{deltaAds}%</b>{" "}
                  <span className="text-[10px] text-muted-foreground">(elasticidad estimada, sin inversión real conectada)</span>
                </Label>
                <input type="range" min={-50} max={100} step={5} value={deltaAds} onChange={(e) => setDeltaAds(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Tarifa courier</Label>
                <Input type="number" className="w-24 font-mono h-8" value={tarifaCourier} onChange={(e) => setTarifaCourier(Number(e.target.value) || 0)} />
                <span className="text-xs text-muted-foreground">S/ por pedido</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <SimCell label="Margen contrib./u" valor={fmtMoney(sim.mc, 2)} />
                <SimCell label="Punto equilibrio" valor={sim.pe ? `${sim.pe} u` : "—"} />
                <SimCell label="Ventas estimadas" valor={fmtMoney(sim.ventas)} />
                <SimCell label="Ganancia estimada" valor={fmtMoney(sim.gananciaSim)} positive={sim.gananciaSim >= 0} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir reporte</DialogTitle>
            <DialogDescription>Listo para pegar en WhatsApp</DialogDescription>
          </DialogHeader>
          <div className="border rounded-xl p-4 bg-card shadow-sm">
            <div className="font-bold text-sm border-b-2 border-foreground pb-2 mb-1">{label.toUpperCase()}</div>
            <ReporteRow label="VENTA TOTAL" valor={fmtMoney(data.ventaTotal)} bold />
            <ReporteRow label="PRODUCTO" valor={fmtMoney(data.producto)} />
            <ReporteRow label="ENVÍOS" valor={fmtMoney(data.envios)} />
            <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-300 pt-2">
              <span>GANANCIA</span>
              <span className="font-mono">{fmtMoney(ganancia)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Publicidad todavía no está conectada (ver Pauta por canal), así que no se incluye en este resumen. El envío automático por WhatsApp llega en Fase 2.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cerrar</Button>
            <Button onClick={handleCopy}><Copy className="h-4 w-4 mr-1.5" /> Copiar texto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReporteRow({ label, valor, bold, muted }: { label: string; valor: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 border-b text-sm ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className={`font-mono ${muted ? "text-muted-foreground text-xs" : ""}`}>{valor}</span>
    </div>
  );
}

function SimCell({ label, valor, positive }: { label: string; valor: string; positive?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 text-center ${positive === undefined ? "bg-muted" : positive ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-bold font-mono ${positive === undefined ? "" : positive ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>{valor}</p>
    </div>
  );
}
