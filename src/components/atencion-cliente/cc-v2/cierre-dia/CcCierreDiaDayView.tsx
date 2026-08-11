"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackageSearch, Pencil, CheckCircle2, Save } from "lucide-react";
import { useCierreDiaClosingDataDay, useCierreDiaDay, useSaveCierreDia } from "@/hooks/useCierreDia";
import { CcCierreDiaProductTable } from "./CcCierreDiaProductTable";
import { CcCierreDiaUpsellCards } from "./CcCierreDiaUpsellCards";
import { CcCierreDiaCpvCard, CpvValues } from "./CcCierreDiaCpvCard";
import { CcCierreDiaEstadoBadge } from "./CcCierreDiaEstadoBadge";
import {
  computeMetrics,
  EMPTY_PRODUCT_TOTALS,
  formatCurrency,
  formatDate,
  formatPct,
  FUNNEL_STATES,
  toEffectiveRecord,
  todayISO,
} from "./cierreDiaUtils";

interface Props {
  storeId: string;
  date: string;
  onRegularizar: (date: string) => void;
}

export function CcCierreDiaDayView({ storeId, date, onRegularizar }: Props) {
  // Solo el día de hoy se refresca solo (cada 30s + al volver a la pestaña)
  // — un día pasado ya cerrado no va a cambiar, no vale la pena pollear.
  const isToday = date === todayISO();
  const { data: manualRecord, isLoading: isLoadingManual } = useCierreDiaDay(storeId, date, isToday);
  const { data: closingData, isLoading: isLoadingProductos, isError: isErrorProductos } =
    useCierreDiaClosingDataDay(storeId, date, isToday);

  if (isLoadingManual || isLoadingProductos) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-8 text-center text-gray-400 dark:text-slate-500 text-sm">
        Cargando cierre del día...
      </div>
    );
  }

  const autoDay = closingData?.byDay.find((d) => d.date === date);
  const record = toEffectiveRecord(storeId, date, manualRecord, autoDay);

  if (!record) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-10 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-bold mb-1">Sin datos para este día</p>
          <p className="text-xs text-muted-foreground mb-4">
            No hay pedidos COD registrados ni un cierre guardado para esta fecha. Puedes
            regularizarlo ingresando los datos manualmente.
          </p>
          <Button onClick={() => onRegularizar(date)}>
            + Regularizar datos de este día
          </Button>
        </CardContent>
      </Card>
    );
  }

  const m = computeMetrics(record);

  return (
    <CcCierreDiaDayContent
      storeId={storeId}
      date={date}
      record={record}
      metrics={m}
      closingData={closingData}
      isLoadingProductos={isLoadingProductos}
      isErrorProductos={isErrorProductos}
      onRegularizar={onRegularizar}
    />
  );
}

interface ContentProps {
  storeId: string;
  date: string;
  record: NonNullable<ReturnType<typeof toEffectiveRecord>>;
  metrics: ReturnType<typeof computeMetrics>;
  closingData: ReturnType<typeof useCierreDiaClosingDataDay>["data"];
  isLoadingProductos: boolean;
  isErrorProductos: boolean;
  onRegularizar: (date: string) => void;
}

function CcCierreDiaDayContent({
  storeId, date, record, metrics: m, closingData, isLoadingProductos, isErrorProductos, onRegularizar,
}: ContentProps) {
  // Pedidos CREADOS hoy (cohorte por created_at) — distinto de `m.total`,
  // que es el embudo agrupado por fecha de última actualización (ver BUG
  // CONFIRMADO en cierreDiaProductosService.ts). No tienen por qué coincidir.
  // `record.pedidosIngresados` ya resuelve guardado a mano vs. detectado en
  // vivo (ver toEffectiveRecord) — así el número confirmado (ajustado por
  // duplicados, por ejemplo) es el mismo acá que en el modal de edición.
  const pedidosIngresados = record.pedidosIngresados;
  const saveMutation = useSaveCierreDia(storeId);
  const [cpvValues, setCpvValues] = useState<CpvValues>({
    publiMeta: record.publiMeta,
    publiTiktok: record.publiTiktok,
    publiGoogle: record.publiGoogle,
  });

  // Si se guarda desde el modal (u otra pestaña) mientras esta vista está
  // abierta, el registro se refresca — sincronizamos los inputs de CPV.
  useEffect(() => {
    setCpvValues({
      publiMeta: record.publiMeta,
      publiTiktok: record.publiTiktok,
      publiGoogle: record.publiGoogle,
    });
  }, [record.publiMeta, record.publiTiktok, record.publiGoogle]);

  // Recalculado en vivo mientras se edita el gasto publicitario, antes de
  // guardar — igual que `calcCPV()` en el mockup.
  const publiLive = cpvValues.publiMeta + cpvValues.publiTiktok + cpvValues.publiGoogle;
  const margenBrutoLive = record.ingreso - record.costo;
  const margenNetoLive = margenBrutoLive - publiLive;
  const pctMargenNetoLive = record.ingreso ? (margenNetoLive / record.ingreso) * 100 : 0;

  async function handleGuardarDia() {
    try {
      await saveMutation.mutateAsync({
        date,
        input: {
          pedidosIngresados: record.pedidosIngresados,
          porConfirmar: record.porConfirmar,
          contactado: record.contactado,
          noContesta: record.noContesta,
          confirmado: record.confirmado,
          despachado: record.despachado,
          entregado: record.entregado,
          anulado: record.anulado,
          ingreso: record.ingreso,
          costo: record.costo,
          upsells: record.upsells,
          ...cpvValues,
        },
      });
      toast.success("Día guardado");
    } catch {
      toast.error("No se pudo guardar el día");
    }
  }

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold flex items-center gap-2 flex-wrap">
            Cierre del Día · <span className="text-teal-600 dark:text-teal-400">{formatDate(date)}</span>
            <CcCierreDiaEstadoBadge isAuto={record.isAuto} />
          </h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            {record.isAuto ? (
              <>Calculado en vivo desde los pedidos COD del día · gasto publicitario pendiente de cargar</>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Guardado el {new Date(record.updatedAt).toLocaleString("es-PE")}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onRegularizar(date)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar datos
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleGuardarDia}
            disabled={saveMutation.isPending}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saveMutation.isPending ? "Guardando..." : "Guardar día"}
          </Button>
        </div>
      </div>

      {/* total box */}
      <Card className="border-0 bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-sm">
        <CardContent className="py-4 px-5 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">
              Pedidos ingresados
            </p>
            <p className="text-4xl font-black leading-none">{pedidosIngresados}</p>
            <p className="text-[9px] text-white/55 mt-0.5">Todos los pedidos creados hoy</p>
          </div>
          <div className="h-10 w-px bg-white/20 hidden sm:block" />
          <div className="text-center">
            <p className="text-[10px] text-white/70">Tasa confirm.</p>
            <p className="text-lg font-extrabold text-emerald-300">{formatPct(m.tasaConfirmacion)}</p>
          </div>
          <div className="h-10 w-px bg-white/20 hidden sm:block" />
          <div className="text-center">
            <p className="text-[10px] text-white/70">Tasa anulación</p>
            <p className="text-lg font-extrabold text-red-300">{formatPct(m.tasaAnulacion)}</p>
          </div>
          <div className="h-10 w-px bg-white/20 hidden sm:block" />
          <div className="text-center">
            <p className="text-[10px] text-white/70">En gestión</p>
            <p className="text-lg font-extrabold text-amber-200">{formatPct(m.tasaEnGestion)}</p>
          </div>
          <div className="h-10 w-px bg-white/20 hidden sm:block" />
          <div className="ml-auto text-right">
            <p className="text-[10px] text-white/70">Ingreso (confirm+desp+entreg)</p>
            <p className="text-xl font-extrabold">{formatCurrency(record.ingreso)}</p>
            <p className="text-[10px] text-white/70">
              Margen neto: {formatCurrency(m.margenNeto)} ({formatPct(m.pctMargenNeto)})
            </p>
          </div>
        </CardContent>
      </Card>

      {/* funnel */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
          Estado actual de los pedidos gestionados hoy ({m.total})
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {FUNNEL_STATES.map((s) => {
            const count = record[s.key];
            const pct = m.total ? (count / m.total) * 100 : 0;
            return (
              <Card key={s.key} className="border shadow-none">
                <CardContent className="py-2.5 px-2 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                    {s.label}
                  </p>
                  <p className={`text-xl font-extrabold leading-tight ${s.colorClass}`}>{count}</p>
                  <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${s.barClass}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">{formatPct(pct)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* upsells — datos reales del día (pedidos + upsell-records) */}
      <CcCierreDiaUpsellCards summary={closingData?.upsellSummary} isLoading={isLoadingProductos} />

      {/* CPV: gasto por plataforma (editable) + resumen de rentabilidad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CcCierreDiaCpvCard values={cpvValues} onChange={setCpvValues} />

        <Card className="border-0 bg-gradient-to-br from-teal-600 to-teal-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wide text-white/80">
              Resumen de rentabilidad · Hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Row label="💵 Ingreso bruto" value={formatCurrency(record.ingreso)} />
            <Row label="📦 Costo de producto" value={`− ${formatCurrency(record.costo)}`} tone="rd" />
            <Row label="📣 Gasto publicidad" value={`− ${formatCurrency(publiLive)}`} tone="rd" />
            <Row label="Margen bruto (sin publi)" value={`${formatCurrency(margenBrutoLive)} · ${formatPct(record.ingreso ? (margenBrutoLive / record.ingreso) * 100 : 0)}`} tone="g" />
            <div className="pt-2 mt-1 border-t border-white/20 flex items-center justify-between">
              <span className="text-sm font-bold">✅ Margen neto real</span>
              <span className="text-lg font-extrabold text-emerald-300">
                {formatCurrency(margenNetoLive)} · {formatPct(pctMargenNetoLive)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* producto — datos reales de pedidos COD del día */}
      <CcCierreDiaProductTable
        rows={closingData?.rows ?? []}
        totals={closingData?.totals ?? EMPTY_PRODUCT_TOTALS}
        isLoading={isLoadingProductos}
        isError={isErrorProductos}
        subtitle={`${formatDate(date)} · ${closingData?.rows.length ?? 0} producto(s)`}
      />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "g" | "rd" }) {
  const toneClass = tone === "g" ? "text-emerald-300" : tone === "rd" ? "text-red-200" : "text-white";
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/10 last:border-0">
      <span className="text-xs text-white/80">{label}</span>
      <span className={`text-sm font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}
