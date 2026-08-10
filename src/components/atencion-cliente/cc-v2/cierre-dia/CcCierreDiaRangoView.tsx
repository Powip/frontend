"use client";

import { useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCierreDiaClosingDataRange, useCierreDiaRange } from "@/hooks/useCierreDia";
import { CierreDiaDayTotals } from "@/services/cierreDiaProductosService";
import { CierreDiaRecord } from "@/interfaces/ICierreDia";
import { CcCierreDiaProductTable } from "./CcCierreDiaProductTable";
import { CcCierreDiaInnerTabs } from "./CcCierreDiaInnerTabs";
import { CcCierreDiaEstadoBadge } from "./CcCierreDiaEstadoBadge";
import {
  computeMetrics, EMPTY_PRODUCT_TOTALS, formatCurrency, formatDate, formatPct, marginColorClass, toEffectiveRecord,
} from "./cierreDiaUtils";

interface Props {
  storeId: string;
  range: DateRange;
  onRegularizar: (date: string) => void;
}

function toISO(d: Date): string {
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

function eachDate(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    out.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const TABS = [
  { key: "resumen", label: "📊 Resumen" },
  { key: "cpv", label: "💰 CPV por plataforma" },
  { key: "productos", label: "📦 Productos" },
] as const;

export function CcCierreDiaRangoView({ storeId, range, onRegularizar }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("resumen");
  const startDate = range.from ? toISO(range.from) : "";
  const endDate = range.to ? toISO(range.to) : startDate;

  const { data: records = [], isLoading: isLoadingManual } = useCierreDiaRange(storeId, startDate, endDate);
  const { data: closingData, isLoading: isLoadingClosing } = useCierreDiaClosingDataRange(storeId, startDate, endDate);
  const isLoading = isLoadingManual || isLoadingClosing;

  const manualByDate = useMemo(() => {
    const map = new Map<string, CierreDiaRecord>();
    records.forEach((r) => map.set(r.date, r));
    return map;
  }, [records]);

  const autoByDate = useMemo(() => {
    const map = new Map<string, CierreDiaDayTotals>();
    closingData?.byDay.forEach((d) => map.set(d.date, d));
    return map;
  }, [closingData]);

  const dates = useMemo(
    () => (range.from ? eachDate(range.from, range.to ?? range.from) : []),
    [range],
  );

  const effectiveByDate = useMemo(() => {
    const map = new Map<string, NonNullable<ReturnType<typeof toEffectiveRecord>>>();
    dates.forEach((ds) => {
      const eff = toEffectiveRecord(storeId, ds, manualByDate.get(ds), autoByDate.get(ds));
      if (eff) map.set(ds, eff);
    });
    return map;
  }, [dates, manualByDate, autoByDate, storeId]);

  const guardadosCount = [...effectiveByDate.values()].filter((r) => !r.isAuto).length;
  const automaticosCount = [...effectiveByDate.values()].filter((r) => r.isAuto).length;

  const totals = useMemo(() => {
    let total = 0, confirmados = 0, anulados = 0, ingreso = 0, publi = 0, costo = 0, margenNeto = 0, pedidosIngresados = 0;
    effectiveByDate.forEach((r) => {
      const m = computeMetrics(r);
      total += m.total;
      confirmados += r.confirmado + r.despachado + r.entregado;
      anulados += r.anulado;
      ingreso += r.ingreso;
      publi += m.publi;
      costo += r.costo;
      margenNeto += m.margenNeto;
    });
    // Pedidos Ingresados se suma aparte, desde `closingData.byDay` — es un
    // cohorte por fecha de creación, distinto del embudo de arriba (que
    // agrupa por fecha de última actualización, ver BUG CONFIRMADO en
    // cierreDiaProductosService.ts). No tiene por qué coincidir con `total`.
    dates.forEach((ds) => {
      pedidosIngresados += autoByDate.get(ds)?.pedidosIngresados ?? 0;
    });
    return { total, confirmados, anulados, ingreso, publi, costo, margenNeto, pedidosIngresados };
  }, [effectiveByDate, dates, autoByDate]);

  return (
    <div className="space-y-4">
      <CcCierreDiaInnerTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "resumen" && (
        isLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-8 text-center text-gray-400 dark:text-slate-500 text-sm">
            Cargando...
          </div>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm">Resumen por rango</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {guardadosCount} guardado(s) · {automaticosCount} automático(s) · de {dates.length} día(s)
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-center">Pedidos Ingresados</TableHead>
                      <TableHead className="text-center">Gestionados</TableHead>
                      <TableHead className="text-center">N° Confirmados</TableHead>
                      <TableHead className="text-center">N° Por confirmar / Anul.</TableHead>
                      <TableHead className="text-center">% Confirm.</TableHead>
                      <TableHead className="text-center">% Anul.</TableHead>
                      <TableHead className="text-right">Ingreso S/</TableHead>
                      <TableHead className="text-right">Publi S/</TableHead>
                      <TableHead className="text-right">Mg. Neto S/</TableHead>
                      <TableHead className="text-right">% Neto</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dates.map((ds) => {
                      const r = effectiveByDate.get(ds);
                      const pedidosIngresadosDia = autoByDate.get(ds)?.pedidosIngresados ?? 0;
                      if (!r) {
                        return (
                          <TableRow key={ds} className="opacity-60">
                            <TableCell className="font-medium">{formatDate(ds, { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                            <TableCell className="text-center font-bold">{pedidosIngresadosDia || "—"}</TableCell>
                            <TableCell colSpan={8} className="text-xs text-amber-600 dark:text-amber-400">
                              Sin pedidos ni cierre guardado —{" "}
                              <button className="underline font-medium" onClick={() => onRegularizar(ds)}>
                                Regularizar
                              </button>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-amber-600 border-amber-300">Pendiente</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      }
                      const m = computeMetrics(r);
                      // Confirmados/anulados vienen del embudo de Gestión COD
                      // (r.confirmado/despachado/entregado/anulado — ver
                      // mapOrderToFunnelBucket en cierreDiaProductosService.ts,
                      // que excluye a propósito los subEstadoCc de Lima/Carrito
                      // abandonado). "Por confirmar / Anul." agrupa lo que
                      // todavía no llegó a confirmado (porConfirmar+contactado+
                      // noContesta) junto con lo anulado.
                      const confirmadosCount = r.confirmado + r.despachado + r.entregado;
                      const porConfirmarOAnuladoCount = m.total - confirmadosCount;
                      return (
                        <TableRow key={ds}>
                          <TableCell className="font-medium">{formatDate(ds, { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                          <TableCell className="text-center font-bold">{pedidosIngresadosDia}</TableCell>
                          <TableCell className="text-center text-muted-foreground font-semibold">{m.total}</TableCell>
                          <TableCell className="text-center text-emerald-600 dark:text-emerald-400 font-semibold">{confirmadosCount}</TableCell>
                          <TableCell className="text-center text-muted-foreground font-semibold">{porConfirmarOAnuladoCount}</TableCell>
                          <TableCell className="text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                            {formatPct(m.tasaConfirmacion)} <span className="text-[10px] opacity-70">({confirmadosCount})</span>
                          </TableCell>
                          <TableCell className="text-center text-red-600 dark:text-red-400 font-semibold">
                            {formatPct(m.tasaAnulacion)} <span className="text-[10px] opacity-70">({r.anulado})</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(r.ingreso)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(m.publi)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(m.margenNeto)}</TableCell>
                          <TableCell className={`text-right font-semibold ${marginColorClass(m.pctMargenNeto)}`}>{formatPct(m.pctMargenNeto)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <CcCierreDiaEstadoBadge isAuto={r.isAuto} />
                              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => onRegularizar(ds)}>
                                ✎
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {effectiveByDate.size > 0 && (
                    <tfoot>
                      <TableRow className="bg-teal-50 dark:bg-teal-950/30 font-bold">
                        <TableCell>TOTAL / PROM.</TableCell>
                        <TableCell className="text-center">{totals.pedidosIngresados}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{totals.total}</TableCell>
                        <TableCell className="text-center text-emerald-600 dark:text-emerald-400">{totals.confirmados}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{totals.total - totals.confirmados}</TableCell>
                        <TableCell className="text-center text-emerald-600 dark:text-emerald-400">
                          {formatPct(totals.total ? (totals.confirmados / totals.total) * 100 : 0)}{" "}
                          <span className="text-[10px] opacity-70">({totals.confirmados})</span>
                        </TableCell>
                        <TableCell className="text-center text-red-600 dark:text-red-400">
                          {formatPct(totals.total ? (totals.anulados / totals.total) * 100 : 0)}{" "}
                          <span className="text-[10px] opacity-70">({totals.anulados})</span>
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.ingreso)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totals.publi)}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.margenNeto)}</TableCell>
                        <TableCell className="text-right">
                          {formatPct(totals.ingreso ? (totals.margenNeto / totals.ingreso) * 100 : 0)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </tfoot>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {tab === "cpv" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💰 Inversión por plataforma · Día a día</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ingreso/costo se calculan solos desde los pedidos — el gasto por plataforma siempre hay que cargarlo a mano.
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right text-blue-600 dark:text-blue-400">📘 Meta S/</TableHead>
                    <TableHead className="text-right text-green-600 dark:text-green-400">🎵 TikTok S/</TableHead>
                    <TableHead className="text-right text-amber-600 dark:text-amber-400">🔍 Google S/</TableHead>
                    <TableHead className="text-right">Total Publi S/</TableHead>
                    <TableHead className="text-right">Mg. Neto S/</TableHead>
                    <TableHead className="text-center">Datos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dates.map((ds) => {
                    const r = effectiveByDate.get(ds);
                    if (!r) {
                      return (
                        <TableRow key={ds} className="opacity-60">
                          <TableCell className="font-medium">{formatDate(ds, { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                          <TableCell colSpan={5} className="text-xs text-red-600 dark:text-red-400">
                            Sin pedidos ni cierre guardado —{" "}
                            <button className="underline font-medium" onClick={() => onRegularizar(ds)}>Regularizar</button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-red-600 border-red-300">Sin datos</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const m = computeMetrics(r);
                    const hasPlatform = r.publiMeta > 0 || r.publiTiktok > 0 || r.publiGoogle > 0;
                    return (
                      <TableRow key={ds}>
                        <TableCell className="font-medium">{formatDate(ds, { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                        <TableCell className="text-right text-blue-600 dark:text-blue-400 font-semibold">{r.publiMeta > 0 ? formatCurrency(r.publiMeta) : "—"}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400 font-semibold">{r.publiTiktok > 0 ? formatCurrency(r.publiTiktok) : "—"}</TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400 font-semibold">{r.publiGoogle > 0 ? formatCurrency(r.publiGoogle) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(m.publi)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(m.margenNeto)}</TableCell>
                        <TableCell className="text-center">
                          {hasPlatform ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300">✓ Completo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">Sin publicidad cargada</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "productos" && (
        <CcCierreDiaRangoProductos storeId={storeId} startDate={startDate} endDate={endDate} />
      )}
    </div>
  );
}

function CcCierreDiaRangoProductos({
  storeId, startDate, endDate,
}: { storeId: string; startDate: string; endDate: string }) {
  const { data, isLoading, isError } = useCierreDiaClosingDataRange(storeId, startDate, endDate);
  return (
    <CcCierreDiaProductTable
      rows={data?.rows ?? []}
      totals={data?.totals ?? EMPTY_PRODUCT_TOTALS}
      isLoading={isLoading}
      isError={isError}
      subtitle={`${startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : "Rango seleccionado"} · ${data?.rows.length ?? 0} producto(s)`}
    />
  );
}
