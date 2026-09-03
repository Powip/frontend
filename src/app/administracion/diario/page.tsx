"use client";

/**
 * Control diario de pauta — §9 doc técnica.
 *
 * CONECTADO A DATOS REALES: Órdenes, Unidades y Venta por día y por canal
 * salen de `getOrdersByCompany`, agrupados por `salesChannel` real (ver
 * `_lib/realData.ts`). El periodo es el mismo mes que el selector del
 * topbar (`useAdminPeriod`).
 *
 * SOLUCIÓN PUENTE (localStorage, sin backend):
 * - Inversión, CPO, CPV y ROAS por día salen de las entradas fechadas que
 *   se registran en Pauta por canal (`usePautaEntries` + `inversionPorDia`,
 *   `_lib/pautaStorage.ts`).
 * - Objetivo de CPV, presupuesto del mes y meta de ventas por canal
 *   (`useObjetivoCanal`, `_lib/objetivoStorage.ts`) — antes vivían
 *   hardcodeados en el mock, ahora los edita el usuario y habilitan la card
 *   "Cumplimiento del mes vs objetivo".
 * Ambos viven en `localStorage` del navegador — si no registraste algo para
 * un día/canal, esa fila simplemente no tiene monto (S/ 0), no es que falte
 * conectar nada.
 *
 * SIGUE SIN DATO REAL:
 * - Canales: usa el `SalesChannel` real (7 valores), más genérico que los 8
 *   canales del doc (no hay TikTok ni Falabella/Ripley/Web-COD separados) —
 *   esto sí necesita que el backend agregue esos valores, no hay solución
 *   posible desde el frontend.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { getOrdersByCompany } from "@/api/Ventas";
import { CANALES_REALES, agruparPorDia, agruparPorCanal } from "../_lib/realData";
import { usePautaEntries, inversionPorDia } from "../_lib/pautaStorage";
import { useObjetivoCanal } from "../_lib/objetivoStorage";
import { fmtMoney, fmtNum, fmtPct } from "../_lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Vista = "canal" | "todos";

const STALE = 5 * 60 * 1000;

export default function ControlDiarioPage() {
  const { auth } = useAuth();
  const { fromDate, toDate } = useAdminPeriod();
  const [vista, setVista] = useState<Vista>("canal");
  const [canalId, setCanalId] = useState(CANALES_REALES[0].id);

  const companyId = auth?.company?.id ?? "";
  const [pautaEntries] = usePautaEntries(companyId);
  const [anio, mesNum] = fromDate.split("-").map(Number);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-diario-orders", companyId, fromDate, toDate],
    queryFn: () => getOrdersByCompany(companyId, fromDate, toDate),
    enabled: !!companyId,
    staleTime: STALE,
  });

  const diasEnMes = new Date(anio, mesNum, 0).getDate();
  const inversionDiaCanal = useMemo(() => inversionPorDia(pautaEntries, canalId, mesNum, anio), [pautaEntries, canalId, mesNum, anio]);

  const diasDelCanal = useMemo(() => {
    const map = agruparPorDia(orders as any[], canalId, mesNum, anio);
    return Array.from({ length: diasEnMes }, (_, i) => {
      const dia = i + 1;
      const base = map[dia] ?? { ordenes: 0, unidades: 0, venta: 0 };
      const inversion = inversionDiaCanal[dia] ?? 0;
      return { dia, ...base, inversion };
    }).filter((d) => d.ordenes > 0 || d.inversion > 0 || d.dia <= new Date().getDate());
  }, [orders, canalId, mesNum, anio, diasEnMes, inversionDiaCanal]);

  const totales = diasDelCanal.reduce(
    (a, d) => ({ ordenes: a.ordenes + d.ordenes, unidades: a.unidades + d.unidades, venta: a.venta + d.venta, inversion: a.inversion + d.inversion }),
    { ordenes: 0, unidades: 0, venta: 0, inversion: 0 },
  );
  const cpoMes = totales.ordenes > 0 ? totales.inversion / totales.ordenes : null;
  const cpvMes = totales.unidades > 0 && totales.inversion > 0 ? totales.inversion / totales.unidades : null;
  const roasMes = totales.inversion > 0 ? totales.venta / totales.inversion : null;

  const semanas = useMemo(() => {
    const rangos: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, diasEnMes]];
    return rangos
      .filter(([a]) => a <= diasEnMes)
      .map(([a, b], i) => {
        const sub = diasDelCanal.filter((d) => d.dia >= a && d.dia <= Math.min(b, diasEnMes));
        const t = sub.reduce((x, d) => ({ ordenes: x.ordenes + d.ordenes, unidades: x.unidades + d.unidades, venta: x.venta + d.venta, inversion: x.inversion + d.inversion }), { ordenes: 0, unidades: 0, venta: 0, inversion: 0 });
        return { label: `S${i + 1} (${a}-${Math.min(b, diasEnMes)})`, ...t };
      });
  }, [diasDelCanal, diasEnMes]);

  const canalActual = CANALES_REALES.find((c) => c.id === canalId)!;

  const [objetivo, setObjetivo] = useObjetivoCanal(companyId, canalId);
  const [objDialogOpen, setObjDialogOpen] = useState(false);
  const [objForm, setObjForm] = useState(objetivo);
  const tPromMes = totales.ordenes > 0 ? totales.unidades / totales.ordenes : null;

  const cumplimiento = objetivo.presupuestoMes > 0 || objetivo.metaVentasMes > 0 || objetivo.objetivoCpv > 0
    ? [
        { label: "Inversión vs presupuesto", actual: totales.inversion, meta: objetivo.presupuestoMes, fmt: fmtMoney, invertido: false },
        { label: "Ventas vs objetivo", actual: totales.venta, meta: objetivo.metaVentasMes, fmt: fmtMoney, invertido: false },
        { label: "CPV vs objetivo (menor es mejor)", actual: cpvMes ?? 0, meta: objetivo.objetivoCpv, fmt: (n: number) => fmtMoney(n, 2), invertido: true },
      ].filter((c) => c.meta > 0)
    : [];

  function guardarObjetivo() {
    setObjetivo(objForm);
    setObjDialogOpen(false);
    toast.success("Objetivo guardado en este dispositivo");
  }

  if (isLoading) {
    return <div className="p-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Órdenes reales · inversión guardada en este dispositivo</p>
          <h2 className="text-lg font-bold mt-0.5">Control diario de pauta</h2>
        </div>
        <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
          <button onClick={() => setVista("canal")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", vista === "canal" ? "bg-background shadow-sm" : "text-muted-foreground")}>Por canal</button>
          <button onClick={() => setVista("todos")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold", vista === "todos" ? "bg-background shadow-sm" : "text-muted-foreground")}>Todos los canales</button>
        </div>
      </div>

      <div className="rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3.5 text-xs text-blue-800 dark:text-blue-300">
        ℹ️ Órdenes/Unidades/Venta son reales. Inversión/CPO/CPV/ROAS salen de lo que registres en Pauta por canal, guardado en este dispositivo — si un día no tiene inversión registrada, aparece en S/ 0.
      </div>

      {vista === "canal" ? (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap gap-1.5">
              {CANALES_REALES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCanalId(c.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    canalId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => { setObjForm(objetivo); setObjDialogOpen(true); }}>
              <Target className="h-3.5 w-3.5 mr-1.5" /> Objetivo de {canalActual.nombre}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard label="Órdenes del mes" valor={fmtNum(totales.ordenes)} sub={`${fmtNum(totales.unidades)} unidades`} />
            <KpiCard label="T.Prom" valor={tPromMes != null ? tPromMes.toFixed(2) : "—"} sub="unidades ÷ órdenes" />
            <KpiCard label="Venta del mes" valor={fmtMoney(totales.venta)} sub={canalActual.nombre} />
            <KpiCard label="CPV del mes" valor={cpvMes != null ? fmtMoney(cpvMes, 2) : "—"} sub="inversión ÷ unidades" />
            <KpiCard label="ROAS del mes" valor={roasMes != null ? `${roasMes.toFixed(1)}×` : "—"} sub="venta ÷ inversión" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Seguimiento diario — {canalActual.nombre} <span className="text-xs font-normal text-muted-foreground">Órdenes · Unidades · T.Prom · Venta · Inversión · CPO · CPV · ROAS</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead className="text-right">Órdenes</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">T.Prom</TableHead>
                    <TableHead className="text-right">Venta S/</TableHead>
                    <TableHead className="text-right">Inversión</TableHead>
                    <TableHead className="text-right">CPO</TableHead>
                    <TableHead className="text-right">CPV</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diasDelCanal.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin pedidos ni inversión de este canal en el periodo.</TableCell></TableRow>
                  ) : diasDelCanal.map((d) => {
                    const esHoy = d.dia === new Date().getDate() && mesNum === new Date().getMonth() + 1 && anio === new Date().getFullYear();
                    const dTProm = d.ordenes > 0 ? d.unidades / d.ordenes : null;
                    const dCpo = d.ordenes > 0 && d.inversion > 0 ? d.inversion / d.ordenes : null;
                    const dCpv = d.unidades > 0 && d.inversion > 0 ? d.inversion / d.unidades : null;
                    const dRoas = d.inversion > 0 ? d.venta / d.inversion : null;
                    return (
                      <TableRow key={d.dia} className={esHoy ? "bg-primary/5" : ""}>
                        <TableCell className="font-semibold">{d.dia}{esHoy ? " · hoy" : ""}</TableCell>
                        <TableCell className="text-right font-mono">{d.ordenes}</TableCell>
                        <TableCell className="text-right font-mono">{d.unidades}</TableCell>
                        <TableCell className="text-right font-mono">{dTProm != null ? dTProm.toFixed(2) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmtMoney(d.venta)}</TableCell>
                        <TableCell className="text-right font-mono">{d.inversion > 0 ? fmtMoney(d.inversion) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{dCpo != null ? fmtMoney(dCpo, 2) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{dCpv != null ? fmtMoney(dCpv, 2) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{dRoas != null ? `${dRoas.toFixed(1)}×` : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell>MES</TableCell>
                    <TableCell className="text-right font-mono">{totales.ordenes}</TableCell>
                    <TableCell className="text-right font-mono">{totales.unidades}</TableCell>
                    <TableCell className="text-right font-mono">{tPromMes != null ? tPromMes.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(totales.venta)}</TableCell>
                    <TableCell className="text-right font-mono">{totales.inversion > 0 ? fmtMoney(totales.inversion) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{cpoMes != null ? fmtMoney(cpoMes, 2) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{cpvMes != null ? fmtMoney(cpvMes, 2) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{roasMes != null ? `${roasMes.toFixed(1)}×` : "—"}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Desglose por semana</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Semana</TableHead><TableHead className="text-right">Órdenes</TableHead><TableHead className="text-right">Unidades</TableHead><TableHead className="text-right">T.Prom</TableHead><TableHead className="text-right">Venta</TableHead><TableHead className="text-right">Inversión</TableHead><TableHead className="text-right">CPV</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {semanas.map((s) => (
                      <TableRow key={s.label}>
                        <TableCell className="font-semibold">{s.label}</TableCell>
                        <TableCell className="text-right font-mono">{s.ordenes}</TableCell>
                        <TableCell className="text-right font-mono">{s.unidades}</TableCell>
                        <TableCell className="text-right font-mono">{s.ordenes > 0 ? (s.unidades / s.ordenes).toFixed(2) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmtMoney(s.venta)}</TableCell>
                        <TableCell className="text-right font-mono">{s.inversion > 0 ? fmtMoney(s.inversion) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{s.unidades > 0 && s.inversion > 0 ? fmtMoney(s.inversion / s.unidades, 1) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Cumplimiento del mes vs objetivo</CardTitle></CardHeader>
              <CardContent>
                {cumplimiento.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-3">Sin objetivo configurado para {canalActual.nombre} todavía.</p>
                    <Button size="sm" onClick={() => { setObjForm(objetivo); setObjDialogOpen(true); }}>
                      <Target className="h-3.5 w-3.5 mr-1.5" /> Configurar objetivo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cumplimiento.map((c) => {
                      const p = c.invertido ? (c.actual > 0 ? (c.meta / c.actual) * 100 : 100) : (c.meta > 0 ? (c.actual / c.meta) * 100 : 0);
                      return (
                        <div key={c.label}>
                          <div className="flex justify-between text-sm mb-1"><span>{c.label}</span><b>{c.fmt(c.actual)} / {c.fmt(c.meta)}</b></div>
                          <Progress value={Math.min(100, p)} />
                          <p className="text-xs text-muted-foreground mt-1">{fmtPct(p, 0)}{p >= 80 ? " ✓" : ""}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Todos los canales — comparado</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                  <TableHead className="text-right">Inversión</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const porCanal = agruparPorCanal(orders as any[]);
                  return CANALES_REALES.map((c) => {
                    const t = porCanal[c.id] ?? { ventas: 0, unidades: 0, pedidos: 0 };
                    const invCanal = pautaEntries.filter((e) => e.canalId === c.id && e.fecha >= fromDate && e.fecha <= toDate).reduce((s, e) => s + e.monto, 0);
                    const roas = invCanal > 0 ? t.ventas / invCanal : null;
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => { setCanalId(c.id); setVista("canal"); }}>
                        <TableCell className="font-semibold">{c.nombre}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{c.grupo === "ecommerce" ? "Ecommerce" : "Marketplace"}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{t.pedidos}</TableCell>
                        <TableCell className="text-right font-mono">{t.unidades}</TableCell>
                        <TableCell className="text-right font-mono">{fmtMoney(t.ventas)}</TableCell>
                        <TableCell className="text-right font-mono">{invCanal > 0 ? fmtMoney(invCanal) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{roas != null ? `${roas.toFixed(1)}×` : "—"}</TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={objDialogOpen} onOpenChange={setObjDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Objetivo de {canalActual.nombre}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Objetivo de CPV (S/, menor es mejor)</Label>
              <Input type="number" value={objForm.objetivoCpv || ""} onChange={(e) => setObjForm((f) => ({ ...f, objetivoCpv: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Presupuesto del mes S/</Label>
              <Input type="number" value={objForm.presupuestoMes || ""} onChange={(e) => setObjForm((f) => ({ ...f, presupuestoMes: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meta de ventas del mes S/</Label>
              <Input type="number" value={objForm.metaVentasMes || ""} onChange={(e) => setObjForm((f) => ({ ...f, metaVentasMes: Number(e.target.value) || 0 }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Se guarda en este dispositivo, por canal — no se sincroniza con el resto del equipo todavía.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjDialogOpen(false)}>Cancelar</Button>
            <Button onClick={guardarObjetivo}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold font-mono mt-1">{valor}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
