"use client";

/**
 * Resumen Anual y Metas — §15 doc técnica.
 *
 * CONECTADO A DATOS REALES: los KPIs mes a mes (ventas, COGS, margen bruto,
 * profit, margen neto), el heatmap, la proyección de cierre, mejor/peor mes,
 * Gastos x mes y el comparativo año actual vs año anterior salen de
 * `useAdminYearPnl` (`_lib/useMonthlyPnl.ts`) — agregando pedidos y gastos
 * reales del año, sin llamadas nuevas al backend.
 *
 * SOLUCIÓN PUENTE (localStorage, sin backend):
 * - Metas (ventas/profit/margen objetivo anual): no existe la entidad `meta`
 *   en ningún servicio (§20 doc). Mientras tanto se guardan en
 *   `localStorage` por empresa+año (`_lib/metasStorage.ts`) — sobreviven a
 *   recargar la página, pero viven solo en este navegador/dispositivo, no
 *   se comparten entre usuarios ni equipos. Reporte rápido lee esta misma
 *   meta (÷12) para su meta mensual. Cuando exista el backend, reemplazar
 *   `useMetasAnuales` por una query/mutation real.
 * - CPV y ROAS (tabla KPIs+Metas y Vista mensual): la inversión mensual sale
 *   de sumar las entradas fechadas de Pauta por canal
 *   (`usePautaEntries` + `inversionPorMes`), guardada en este dispositivo.
 *
 * SIGUE SIN DATO REAL:
 * - El semáforo por mes es una versión simplificada (solo margen neto vs
 *   meta) del semáforo de 4 indicadores del doc (§7.7), que también
 *   necesita ROAS y tasa de confirmación.
 * - "Ventas por tienda" (Vista general) es real (agrupa pedidos por
 *   `storeId`), pero no hay "profit por tienda" — `IGastoOperativo` no
 *   trae tienda, así que los gastos no se pueden prorratear por tienda. Y
 *   sigue sin existir meta por tienda (no hay esa entidad).
 */

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminYearPnl, type MesPnlReal } from "../_lib/useMonthlyPnl";
import { useMetasAnuales, type MetasAnuales } from "../_lib/metasStorage";
import { usePautaEntries, inversionPorMes } from "../_lib/pautaStorage";
import { soloEntregados } from "../_lib/realData";
import { MESES_CORTOS, MESES_LARGOS } from "../_mock/data";
import { fmtMoney, fmtPct } from "../_lib/format";
import { NivelDot, NivelPill, type Nivel } from "../_components/nivel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SubVista = "general" | "kpis" | "mensual" | "gastos" | "comp";

const SUBVISTAS: { value: SubVista; label: string }[] = [
  { value: "general", label: "Vista general" },
  { value: "kpis", label: "📊 KPIs + Metas" },
  { value: "mensual", label: "🗓️ Vista mensual" },
  { value: "gastos", label: "💸 Gastos x mes" },
  { value: "comp", label: "⚖️ Año vs año anterior" },
];

const CATEGORIAS_GASTO: { value: string; label: string }[] = [
  { value: "PLANILLA", label: "Personal / Planilla" },
  { value: "HERRAMIENTAS", label: "Herramientas + Oficina" },
  { value: "PUBLICIDAD", label: "Publicidad" },
  { value: "COURIER_PROPIO", label: "Courier Propio" },
  { value: "OTRO", label: "Otro" },
];

function semaforoMes(m: MesPnlReal, margenObjetivo: number): Nivel {
  if (!m.tieneDatos || m.margenNetoPct == null) return "sin-datos";
  if (m.margenNetoPct >= margenObjetivo) return "verde";
  if (m.margenNetoPct >= margenObjetivo * 0.6) return "ambar";
  return "rojo";
}

export default function ResumenAnualPage() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const token = auth?.accessToken ?? "";
  const storeIds = useMemo(() => (auth?.company?.stores ?? []).map((s) => s.id), [auth?.company?.stores]);

  const anioActual = new Date().getFullYear();
  const { meses, isLoading, gastosRaw, ordersRaw } = useAdminYearPnl(companyId, anioActual, storeIds, token);
  const { meses: mesesAnioAnterior, isLoading: loadingAnterior } = useAdminYearPnl(companyId, anioActual - 1, storeIds, token);

  const [pautaEntries] = usePautaEntries(companyId);
  const inversionMensual = useMemo(() => inversionPorMes(pautaEntries, anioActual), [pautaEntries, anioActual]);

  const [vista, setVista] = useState<SubVista>("general");
  const [metas, setMetas] = useMetasAnuales(companyId, anioActual);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(metas);

  const mesesConDatos = meses.filter((m) => m.tieneDatos);
  const ventasAcum = mesesConDatos.reduce((a, m) => a + m.ventas, 0);
  const profitAcum = mesesConDatos.reduce((a, m) => a + m.profit, 0);
  const margenProm = mesesConDatos.length ? mesesConDatos.reduce((a, m) => a + (m.margenNetoPct ?? 0), 0) / mesesConDatos.length : 0;
  const mesesTranscurridos = mesesConDatos.length;

  const proyeccion = useMemo(() => {
    const estVentas = mesesTranscurridos ? Math.round((ventasAcum / mesesTranscurridos) * 12) : 0;
    const estProfit = mesesTranscurridos ? Math.round((profitAcum / mesesTranscurridos) * 12) : 0;
    return { estVentas, estProfit };
  }, [ventasAcum, profitAcum, mesesTranscurridos]);

  function guardarMetas() {
    setMetas(form);
    setDialogOpen(false);
    toast.success("Metas guardadas en este dispositivo — no se sincronizan con otros usuarios todavía");
  }

  if (isLoading || loadingAnterior) {
    return <div className="p-8 space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Resumen Anual {anioActual}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Todos los meses (reales) · Metas guardadas en este dispositivo (localStorage) · Proyección de cierre</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setForm(metas); setDialogOpen(true); }}>
          <Target className="h-4 w-4 mr-1.5" /> Editar metas {anioActual}
        </Button>
      </div>

      <div className="inline-flex bg-muted rounded-lg p-1 gap-1 flex-wrap">
        {SUBVISTAS.map((s) => (
          <button key={s.value} onClick={() => setVista(s.value)} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap", vista === s.value ? "bg-background shadow-sm" : "text-muted-foreground")}>{s.label}</button>
        ))}
      </div>

      {vista === "general" && (
        <VistaGeneral anioActual={anioActual} meses={meses} ventasAcum={ventasAcum} profitAcum={profitAcum} margenProm={margenProm} mesesTranscurridos={mesesTranscurridos} metas={metas} proyeccion={proyeccion} stores={auth?.company?.stores ?? []} ordersRaw={ordersRaw} />
      )}
      {vista === "kpis" && <VistaKpis meses={meses} metas={metas} inversionMensual={inversionMensual} />}
      {vista === "mensual" && <VistaMensual meses={meses} metas={metas} inversionMensual={inversionMensual} />}
      {vista === "gastos" && <VistaGastos gastosRaw={gastosRaw as any[]} anio={anioActual} />}
      {vista === "comp" && <VistaComparativo anioActual={anioActual} mesesActual={meses} mesesAnterior={mesesAnioAnterior} />}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar metas {anioActual}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Meta de ventas anual S/</Label>
              <Input type="number" value={form.ventasAnual} onChange={(e) => setForm((f) => ({ ...f, ventasAnual: Number(e.target.value) || 0 }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Meta de profit anual S/</Label>
                <Input type="number" value={form.profitAnual} onChange={(e) => setForm((f) => ({ ...f, profitAnual: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Margen objetivo %</Label>
                <Input type="number" value={form.margenObjetivoPct} onChange={(e) => setForm((f) => ({ ...f, margenObjetivoPct: Number(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={guardarMetas}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VistaGeneral({
  anioActual, meses, ventasAcum, profitAcum, margenProm, mesesTranscurridos, metas, proyeccion, stores, ordersRaw,
}: {
  anioActual: number; meses: MesPnlReal[]; ventasAcum: number; profitAcum: number; margenProm: number;
  mesesTranscurridos: number; metas: MetasAnuales; proyeccion: { estVentas: number; estProfit: number };
  stores: { id: string; name?: string }[]; ordersRaw: any[];
}) {
  const ventasPorTienda = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of soloEntregados(ordersRaw)) {
      const sid = o.storeId || "sin-tienda";
      map[sid] = (map[sid] ?? 0) + Number(o.grandTotal || 0);
    }
    return map;
  }, [ordersRaw]);
  const ventasTotalTiendas = Object.values(ventasPorTienda).reduce((a, b) => a + b, 0);
  const mesesConDatos = meses.filter((m) => m.tieneDatos);
  const mejorMes = mesesConDatos.length ? [...mesesConDatos].sort((a, b) => b.profit - a.profit)[0] : null;
  const peorMes = mesesConDatos.length ? [...mesesConDatos].sort((a, b) => a.profit - b.profit)[0] : null;
  const metasCons = [
    { label: "Ventas anuales", actual: `${fmtMoney(ventasAcum)} / ${fmtMoney(metas.ventasAnual)}`, pct: metas.ventasAnual > 0 ? (ventasAcum / metas.ventasAnual) * 100 : 0 },
    { label: "Profit anual", actual: `${fmtMoney(profitAcum)} / ${fmtMoney(metas.profitAnual)}`, pct: metas.profitAnual > 0 ? (profitAcum / metas.profitAnual) * 100 : 0 },
    { label: "Margen objetivo", actual: `${fmtPct(margenProm)} / ${metas.margenObjetivoPct}%`, pct: metas.margenObjetivoPct > 0 ? (margenProm / metas.margenObjetivoPct) * 100 : 0 },
  ];
  const maxV = Math.max(...meses.map((m) => m.ventas), 1);
  const verdes = meses.filter((m) => semaforoMes(m, metas.margenObjetivoPct) === "verde").length;
  const rojos = meses.filter((m) => semaforoMes(m, metas.margenObjetivoPct) === "rojo").length;

  return (
    <div className="space-y-6">
      <div className={cn("rounded-2xl p-6 text-white bg-gradient-to-br", profitAcum >= 0 ? "from-emerald-600 to-emerald-800" : "from-red-600 to-red-800")}>
        <p className="text-[11px] font-bold tracking-wide opacity-80 uppercase">{anioActual} · {mesesTranscurridos} meses con datos de 12</p>
        <h3 className="text-xl font-bold mt-1.5">{profitAcum >= 0 ? "🟢 Negocio rentable" : "🔴 Negocio en pérdida"} este año</h3>
        <p className="text-sm opacity-95 mt-1">Profit acumulado {fmtMoney(profitAcum)} · Margen {fmtPct(margenProm, 1)} prom. · {verdes} meses verdes · {rojos} rojos</p>
        <div className="flex gap-1.5 flex-wrap mt-4">
          {meses.map((m) => {
            const s = semaforoMes(m, metas.margenObjetivoPct);
            return (
              <div key={m.mes} className="w-9 text-center text-[10px] opacity-90">
                <div className="text-base leading-none mb-0.5">{s === "verde" ? "🟢" : s === "ambar" ? "🟡" : s === "rojo" ? "🔴" : "⬜"}</div>
                {MESES_CORTOS[m.mes - 1]}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-white/15 rounded-lg p-3"><p className="text-[11px] opacity-85">Ventas acum.</p><p className="text-lg font-bold mt-0.5">{fmtMoney(ventasAcum)}</p></div>
          <div className="bg-white/15 rounded-lg p-3"><p className="text-[11px] opacity-85">Profit acum.</p><p className="text-lg font-bold mt-0.5">{fmtMoney(profitAcum)}</p></div>
          <div className="bg-white/15 rounded-lg p-3"><p className="text-[11px] opacity-85">Margen prom.</p><p className="text-lg font-bold mt-0.5">{fmtPct(margenProm, 1)}</p></div>
          <div className="bg-white/15 rounded-lg p-3"><p className="text-[11px] opacity-85">Mejor mes</p><p className="text-lg font-bold mt-0.5">{mejorMes ? `${MESES_LARGOS[mejorMes.mes - 1]} · ${fmtMoney(mejorMes.profit)}` : "—"}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-indigo-50/40 dark:bg-indigo-500/5">
          <CardHeader><CardTitle className="text-sm">🎯 Metas {anioActual} — Consolidado <span className="text-[10px] font-normal text-muted-foreground">guardado en este dispositivo</span></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {metasCons.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-sm mb-1"><span>{m.label}</span><b>{m.actual}</b></div>
                <Progress value={Math.min(100, m.pct)} />
                <p className="text-xs text-muted-foreground mt-1">{fmtPct(m.pct, 1)}</p>
              </div>
            ))}
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs font-bold text-primary mb-2">📈 Proyección cierre {anioActual} (al ritmo actual)</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Ventas estimadas</span><b>{fmtMoney(proyeccion.estVentas)} <span className="text-muted-foreground font-normal">({metas.ventasAnual > 0 ? fmtPct((proyeccion.estVentas / metas.ventasAnual) * 100, 1) : "—"} de la meta)</span></b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Profit estimado</span><b>{fmtMoney(proyeccion.estProfit)} <span className="text-muted-foreground font-normal">({metas.profitAnual > 0 ? fmtPct((proyeccion.estProfit / metas.profitAnual) * 100, 1) : "—"} de la meta)</span></b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Falta para meta ventas</span><b>{fmtMoney(Math.max(0, metas.ventasAnual - ventasAcum))}</b></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">🏪 Ventas por tienda <span className="text-[10px] font-normal text-muted-foreground">real · sin meta por tienda (no hay esa entidad)</span></CardTitle></CardHeader>
          <CardContent>
            {stores.length <= 1 ? (
              <p className="text-sm text-muted-foreground py-4">Esta empresa tiene {stores.length} tienda configurada — el desglose por tienda no aporta información adicional todavía.</p>
            ) : (
              <div className="space-y-3">
                {stores.map((s) => {
                  const ventas = ventasPorTienda[s.id] ?? 0;
                  const pct = ventasTotalTiendas > 0 ? (ventas / ventasTotalTiendas) * 100 : 0;
                  return (
                    <div key={s.id}>
                      <div className="flex justify-between text-sm mb-1"><span>{s.name ?? s.id}</span><b>{fmtMoney(ventas)}</b></div>
                      <Progress value={pct} />
                      <p className="text-xs text-muted-foreground mt-1">{fmtPct(pct, 1)} del total</p>
                    </div>
                  );
                })}
                {(ventasPorTienda["sin-tienda"] ?? 0) > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Sin tienda asignada</span><b>{fmtMoney(ventasPorTienda["sin-tienda"])}</b></div>
                    <Progress value={(ventasPorTienda["sin-tienda"] / ventasTotalTiendas) * 100} />
                    <p className="text-xs text-muted-foreground mt-1">{fmtPct((ventasPorTienda["sin-tienda"] / ventasTotalTiendas) * 100, 1)} del total — pedidos sin `storeId`</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mejorMes && <MesDestacado mes={mejorMes} tono="verde" titulo="🏆 Mejor mes" />}
        {peorMes && peorMes !== mejorMes && <MesDestacado mes={peorMes} tono="rojo" titulo="📉 Peor mes" />}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">📊 Ventas vs Profit por mes (real)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40 pt-4">
            {meses.map((m) => (
              <div key={m.mes} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                <div className="flex gap-0.5 items-end justify-center w-full h-full">
                  <div className="w-2.5 rounded-t bg-primary" style={{ height: `${(m.ventas / maxV) * 100}%` }} />
                  <div className="w-2.5 rounded-t bg-emerald-500" style={{ height: `${(Math.max(0, m.profit) / maxV) * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{MESES_CORTOS[m.mes - 1].slice(0, 1)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground"><span>▼ Ventas reales</span><span className="text-emerald-600">▼ Profit</span></div>
        </CardContent>
      </Card>
    </div>
  );
}

function MesDestacado({ mes, tono, titulo }: { mes: MesPnlReal; tono: "verde" | "rojo"; titulo: string }) {
  const filas = [
    ["Ventas", fmtMoney(mes.ventas)],
    [mes.profit >= 0 ? "Profit" : "Pérdida", fmtMoney(mes.profit)],
    ["Margen neto", mes.margenNetoPct != null ? fmtPct(mes.margenNetoPct) : "—"],
    ["COGS", fmtMoney(mes.cogs)],
  ];
  const porque = mes.profit >= 0
    ? `Ventas de ${fmtMoney(mes.ventas)} cubrieron ${fmtMoney(mes.cogs + mes.gastosFijos + mes.courierCost)} en costos y gastos, dejando ${fmtPct(mes.margenNetoPct ?? 0)} de margen neto.`
    : `Ventas de ${fmtMoney(mes.ventas)} no cubrieron los ${fmtMoney(mes.cogs + mes.gastosFijos + mes.courierCost)} en COGS + gastos fijos + courier de ese mes.`;
  return (
    <Card className={tono === "verde" ? "bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30" : "bg-red-50/60 dark:bg-red-500/5 border-red-200 dark:border-red-500/30"}>
      <CardHeader><CardTitle className={cn("text-sm", tono === "verde" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>{titulo} — {MESES_LARGOS[mes.mes - 1]} {mes.anio}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {filas.map(([l, v]) => (
            <div key={l}><p className="text-[10px] text-muted-foreground uppercase">{l}</p><p className="text-lg font-bold">{v}</p></div>
          ))}
        </div>
        <div className={cn("rounded-lg p-3 text-xs", tono === "verde" ? "bg-emerald-100/60 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-100/60 dark:bg-red-500/10 text-red-800 dark:text-red-300")}>
          <b>¿Por qué?</b> {porque}
        </div>
      </CardContent>
    </Card>
  );
}

function VistaKpis({ meses, metas, inversionMensual }: { meses: MesPnlReal[]; metas: MetasAnuales; inversionMensual: number[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3.5 text-sm text-blue-800 dark:text-blue-300">
        💡 Ventas, COGS, margen y profit son reales. CPV y ROAS salen de la inversión registrada en Pauta por canal (guardada en este dispositivo) — un mes sin inversión registrada aparece en &quot;—&quot;. Las metas las pones tú.
      </div>
      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>KPI</TableHead>{MESES_CORTOS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40">
                <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">Semáforo (margen neto)</TableCell>
                {meses.map((m) => <TableCell key={m.mes} className="text-center"><NivelDot nivel={semaforoMes(m, metas.margenObjetivoPct)} className="mx-auto" /></TableCell>)}
              </TableRow>
              <FilaKpi label="Ventas" valores={meses.map((m) => (m.tieneDatos ? fmtMoney(m.ventas) : "—"))} />
              <FilaKpi label="🎯 Meta ventas (÷12)" valores={meses.map(() => fmtMoney(metas.ventasAnual / 12))} destacado />
              <FilaKpi label="COGS" valores={meses.map((m) => (m.tieneDatos ? fmtMoney(m.cogs) : "—"))} />
              <FilaKpi label="Gross profit %" valores={meses.map((m) => (m.tieneDatos ? fmtPct(m.utilidadBrutaPct) : "—"))} />
              <FilaKpi label="Gastos + courier" valores={meses.map((m) => (m.tieneDatos ? fmtMoney(m.gastosFijos + m.courierCost) : "—"))} />
              <FilaKpi label="Profit" valores={meses.map((m) => (m.tieneDatos ? fmtMoney(m.profit) : "—"))} />
              <FilaKpi label="🎯 Meta profit (÷12)" valores={meses.map(() => fmtMoney(metas.profitAnual / 12))} destacado />
              <FilaKpi label="Margen neto %" valores={meses.map((m) => (m.margenNetoPct != null ? fmtPct(m.margenNetoPct) : "—"))} />
              <FilaKpi label="Inversión ADS" valores={meses.map((_, i) => (inversionMensual[i] > 0 ? fmtMoney(inversionMensual[i]) : "—"))} />
              <FilaKpi label="CPV neto" valores={meses.map((m, i) => (inversionMensual[i] > 0 && m.unidades > 0 ? fmtMoney(inversionMensual[i] / m.unidades, 2) : "—"))} />
              <FilaKpi label="ROAS" valores={meses.map((m, i) => (inversionMensual[i] > 0 ? `${(m.ventas / inversionMensual[i]).toFixed(1)}×` : "—"))} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FilaKpi({ label, valores, destacado }: { label: string; valores: string[]; destacado?: boolean }) {
  return (
    <TableRow className={destacado ? "bg-indigo-50/50 dark:bg-indigo-500/5" : ""}>
      <TableCell className={cn(destacado && "text-primary font-semibold")}>{label}</TableCell>
      {valores.map((v, i) => <TableCell key={i} className="text-right font-mono">{v}</TableCell>)}
    </TableRow>
  );
}

function VistaMensual({ meses, metas, inversionMensual }: { meses: MesPnlReal[]; metas: MetasAnuales; inversionMensual: number[] }) {
  const hoy = new Date();
  const [mesSeleccionado, setMesSeleccionado] = useState(hoy.getMonth() + 1);
  const mes = meses.find((m) => m.mes === mesSeleccionado) ?? meses[hoy.getMonth()];
  const metaMes = metas.ventasAnual / 12;
  const metaProfitMes = metas.profitAnual / 12;
  const semaforo = semaforoMes(mes, metas.margenObjetivoPct);
  const invMes = inversionMensual[mes.mes - 1] ?? 0;
  const cpvMes = invMes > 0 && mes.unidades > 0 ? invMes / mes.unidades : null;
  const roasMes = invMes > 0 ? mes.ventas / invMes : null;

  const cards: { label: string; valor: string; sub?: string; tone?: "green" | "amber" | "red" | "purple" }[] = [
    { label: "VENTAS", valor: fmtMoney(mes.ventas) },
    { label: `META VENTAS: ${fmtMoney(metaMes)}`, valor: metaMes > 0 ? fmtPct((mes.ventas / metaMes) * 100, 1) : "—", sub: `Faltan ${fmtMoney(Math.max(0, metaMes - mes.ventas))}`, tone: "amber" },
    { label: "PROFIT", valor: `${fmtMoney(mes.profit)} ${mes.profit >= 0 ? "🟢" : "🔴"}` },
    { label: `META PROFIT: ${fmtMoney(metaProfitMes)}`, valor: metaProfitMes > 0 ? fmtPct((mes.profit / metaProfitMes) * 100, 1) : "—", sub: mes.profit >= metaProfitMes ? "✓ Meta alcanzada" : "Por debajo de la meta", tone: mes.profit >= metaProfitMes ? "green" : "amber" },
    { label: "COGS", valor: fmtMoney(mes.cogs), tone: "purple" },
    { label: "GROSS PROFIT %", valor: fmtPct(mes.utilidadBrutaPct), tone: "green" },
    { label: "CPV", valor: cpvMes != null ? fmtMoney(cpvMes, 2) : "—" },
    { label: "ROAS", valor: roasMes != null ? `${roasMes.toFixed(1)}×` : "—" },
  ];
  const TONE_BG: Record<string, string> = {
    amber: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
    green: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
  };
  const TONE_TEXT: Record<string, string> = { green: "text-emerald-600", amber: "text-amber-600", red: "text-destructive", purple: "text-purple-600" };

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2.5 mb-4">
          <NivelDot nivel={semaforo} />
          <h3 className="font-semibold">{MESES_LARGOS[mes.mes - 1]} {mes.anio}</h3>
          <NivelPill nivel={semaforo}>{semaforo === "verde" ? "Negocio sano" : semaforo === "ambar" ? "Ojo con el margen" : semaforo === "rojo" ? "En pérdida" : "Sin datos"}</NivelPill>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className={cn("rounded-lg border p-3", c.tone && TONE_BG[c.tone])}>
              <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
              <p className={cn("text-xl font-bold font-mono mt-1", c.tone && TONE_TEXT[c.tone])}>{c.valor}</p>
              {c.sub && <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" size="sm" disabled={mesSeleccionado <= 1} onClick={() => setMesSeleccionado((m) => m - 1)}>← Mes anterior</Button>
          <Button variant="outline" size="sm" disabled={mesSeleccionado >= 12} onClick={() => setMesSeleccionado((m) => m + 1)}>Mes siguiente →</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VistaGastos({ gastosRaw, anio }: { gastosRaw: any[]; anio: number }) {
  const totalesPorMes = MESES_CORTOS.map((_, i) =>
    CATEGORIAS_GASTO.reduce((s, cat) => s + gastosRaw.filter((g) => g.mes === i + 1 && g.anio === anio && g.categoria === cat.value).reduce((x, g) => x + Number(g.monto || 0), 0), 0),
  );
  const granTotal = totalesPorMes.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 p-3.5 text-sm text-blue-800 dark:text-blue-300">
        💡 Gastos reales de `getGastos`, agrupados por categoría real (Planilla, Herramientas, Publicidad, Courier propio, Otro) y mes. Un mes en blanco significa que no hay gastos registrados ese mes — no hay proyección automática de recurrentes todavía.
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Gastos por categoría × mes — {anio}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Categoría</TableHead>{MESES_CORTOS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}<TableHead className="text-right">Año</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {CATEGORIAS_GASTO.map((cat) => {
                const valores = MESES_CORTOS.map((_, i) => gastosRaw.filter((g) => g.mes === i + 1 && g.anio === anio && g.categoria === cat.value).reduce((s, g) => s + Number(g.monto || 0), 0));
                const total = valores.reduce((a, b) => a + b, 0);
                return (
                  <TableRow key={cat.value}>
                    <TableCell className="font-semibold">{cat.label}</TableCell>
                    {valores.map((v, i) => <TableCell key={i} className="text-right font-mono">{v ? fmtMoney(v) : "—"}</TableCell>)}
                    <TableCell className="text-right font-mono font-bold">{fmtMoney(total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-primary/10 font-bold">
                <TableCell>TOTAL</TableCell>
                {totalesPorMes.map((t, i) => <TableCell key={i} className="text-right font-mono">{fmtMoney(t)}</TableCell>)}
                <TableCell className="text-right font-mono">{fmtMoney(granTotal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function VistaComparativo({ anioActual, mesesActual, mesesAnterior }: { anioActual: number; mesesActual: MesPnlReal[]; mesesAnterior: MesPnlReal[] }) {
  const sum = (arr: MesPnlReal[], key: "ventas" | "profit") => arr.filter((m) => m.tieneDatos).reduce((a, m) => a + m[key], 0);
  const avgMargen = (arr: MesPnlReal[]) => {
    const con = arr.filter((m) => m.margenNetoPct != null);
    return con.length ? con.reduce((a, m) => a + (m.margenNetoPct ?? 0), 0) / con.length : 0;
  };

  const vActual = sum(mesesActual, "ventas"), vAnterior = sum(mesesAnterior, "ventas");
  const pActual = sum(mesesActual, "profit"), pAnterior = sum(mesesAnterior, "profit");
  const mActual = avgMargen(mesesActual), mAnterior = avgMargen(mesesAnterior);

  const delta = (a: number, b: number) => (b !== 0 ? `${a - b >= 0 ? "+" : ""}${(((a - b) / Math.abs(b)) * 100).toFixed(0)}%` : "—");

  const filas = [
    { kpi: "Ventas", anterior: fmtMoney(vAnterior), actual: fmtMoney(vActual), delta: delta(vActual, vAnterior) },
    { kpi: "Profit", anterior: fmtMoney(pAnterior), actual: fmtMoney(pActual), delta: delta(pActual, pAnterior) },
    { kpi: "Margen prom.", anterior: fmtPct(mAnterior), actual: fmtPct(mActual), delta: `${(mActual - mAnterior).toFixed(1)}pp` },
  ];

  const sinDatosAnterior = mesesAnterior.every((m) => !m.tieneDatos);

  return (
    <div className="space-y-4">
      {sinDatosAnterior && (
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 p-3.5 text-sm text-amber-800 dark:text-amber-300">
          ⚠️ No hay pedidos ENTREGADO registrados en {anioActual - 1} — la comparación quedará en S/ 0 hasta que haya historial de ese año en POWIP.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filas.map((c) => (
          <Card key={c.kpi}>
            <CardContent className="pt-4">
              <p className="text-[10px] text-muted-foreground uppercase">{c.kpi}</p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-sm text-muted-foreground">{c.anterior}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-lg font-bold text-primary">{c.actual}</span>
              </div>
              <p className={cn("text-xs mt-1", c.delta.startsWith("+") ? "text-emerald-600" : c.delta.startsWith("-") ? "text-destructive" : "text-muted-foreground")}>{c.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>KPI</TableHead><TableHead className="text-right">{anioActual - 1}</TableHead><TableHead className="text-right">{anioActual}</TableHead><TableHead className="text-right">Δ</TableHead></TableRow></TableHeader>
            <TableBody>
              {filas.map((c) => (
                <TableRow key={c.kpi}>
                  <TableCell className="font-semibold">{c.kpi}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{c.anterior}</TableCell>
                  <TableCell className="text-right font-mono">{c.actual}</TableCell>
                  <TableCell className={cn("text-right font-mono", c.delta.startsWith("+") ? "text-emerald-600" : c.delta.startsWith("-") ? "text-destructive" : "")}>{c.delta}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
