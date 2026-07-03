"use client";

import { DateRange } from "react-day-picker";
import { useCcKpisFunnel } from "@/hooks/useCcKpisFunnel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type {
  CcKpisFunnelDistribucion,
  CcKpisFunnelSubBreakdown,
} from "@/interfaces/IOrder";

/* ── colores semánticos ───────────────────────────────── */
const SEGMENT_CONFIG = [
  {
    key:   "pendiente"  as const,
    label: "Pendiente",
    bg:    "bg-slate-400 dark:bg-slate-500",
    text:  "text-slate-800 dark:text-slate-100",
    dot:   "bg-slate-400 dark:bg-slate-500",
  },
  {
    key:   "confirmado" as const,
    label: "Confirmado",
    bg:    "bg-emerald-500 dark:bg-emerald-600",
    text:  "text-white",
    dot:   "bg-emerald-500 dark:bg-emerald-600",
  },
  {
    key:   "noContesta" as const,
    label: "No contesta",
    bg:    "bg-amber-400 dark:bg-amber-500",
    text:  "text-amber-900 dark:text-amber-100",
    dot:   "bg-amber-400 dark:bg-amber-500",
  },
  {
    key:   "anulado"    as const,
    label: "Anulado",
    bg:    "bg-red-500 dark:bg-red-600",
    text:  "text-white",
    dot:   "bg-red-500 dark:bg-red-600",
  },
] as const;

type SegmentKey = (typeof SEGMENT_CONFIG)[number]["key"];

/* ── sub-barra confirmado ─────────────────────────────── */
const SUB_CONFIG = [
  {
    key:   "entregado"  as const,
    label: "Entregado",
    bg:    "bg-emerald-700 dark:bg-emerald-800",
    text:  "text-white",
    dot:   "bg-emerald-700 dark:bg-emerald-800",
  },
  {
    key:   "despachado" as const,
    label: "En tránsito",
    bg:    "bg-teal-500 dark:bg-teal-600",
    text:  "text-white",
    dot:   "bg-teal-500 dark:bg-teal-600",
  },
] as const;

/* ── badge de cuadre ──────────────────────────────────── */
function CuadreBadge({ dist }: { dist: CcKpisFunnelDistribucion }) {
  const suma =
    dist.pendiente.count +
    dist.confirmado.count +
    dist.noContesta.count +
    dist.anulado.count;
  const cuadra = suma === dist.total;

  if (cuadra) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Cuadre OK
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
      <AlertTriangle className="h-3.5 w-3.5" />
      Desfase: {suma} / {dist.total}
    </span>
  );
}

/* ── barra principal ──────────────────────────────────── */
function BarraPrincipal({ dist }: { dist: CcKpisFunnelDistribucion }) {
  return (
    <div>
      {/* barra apilada */}
      <div className="flex h-8 w-full rounded-md overflow-hidden gap-px bg-muted">
        {SEGMENT_CONFIG.map(({ key, bg, text, label }) => {
          const bucket = dist[key as SegmentKey];
          const pct    = bucket.percentage;
          if (pct <= 0) return null;
          return (
            <div
              key={key}
              className={`${bg} flex items-center justify-center overflow-hidden transition-all`}
              style={{ width: `${pct}%`, minWidth: pct > 0 ? "2px" : 0 }}
              title={`${label}: ${bucket.count} (${pct.toFixed(1)}%)`}
            >
              {pct >= 8 && (
                <span className={`text-[10px] font-semibold ${text} leading-none px-1 truncate`}>
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {SEGMENT_CONFIG.map(({ key, dot, label }) => {
          const bucket = dist[key as SegmentKey];
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-sm ${dot} inline-block shrink-0`} />
              <span className="font-medium text-foreground">{label}</span>
              <span>{bucket.count} · {bucket.percentage.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── sub-barra confirmado ─────────────────────────────── */
function SubBarraConfirmado({
  dist,
  sub,
}: {
  dist: CcKpisFunnelDistribucion;
  sub:  CcKpisFunnelSubBreakdown;
}) {
  const confirmadoCount = dist.confirmado.count;
  if (confirmadoCount === 0) return null;

  // "sin despachar" = confirmados - despachados - entregados (en tránsito + entregado)
  // Clamp a 0: discrepancias transitorias de datos no deben producir valores negativos
  const sinDespacharCount = Math.max(
    0,
    confirmadoCount - sub.despachado.count - sub.entregado.count,
  );
  const sinDespacharPct = confirmadoCount > 0
    ? (sinDespacharCount / confirmadoCount) * 100
    : 0;

  const subSegments = [
    ...SUB_CONFIG.map(({ key, bg, text, dot, label }) => ({
      key,
      bg,
      text,
      dot,
      label,
      count: sub[key].count,
      pct:   sub[key].percentage,
    })),
    {
      key:   "sin_despachar" as const,
      bg:    "bg-emerald-200 dark:bg-emerald-900/60",
      text:  "text-emerald-900 dark:text-emerald-200",
      dot:   "bg-emerald-200 dark:bg-emerald-900/60",
      label: "Sin despachar",
      count: sinDespacharCount,
      pct:   sinDespacharPct,
    },
  ];

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Detalle confirmados ({confirmadoCount} pedidos)
      </p>

      {/* sub-barra */}
      <div className="flex h-5 w-full rounded overflow-hidden gap-px bg-muted">
        {subSegments.map(({ key, bg, text, label, pct, count }) => {
          if (pct <= 0 || count < 0) return null;
          return (
            <div
              key={key}
              className={`${bg} flex items-center justify-center overflow-hidden transition-all`}
              style={{ width: `${pct}%`, minWidth: pct > 0 ? "2px" : 0 }}
              title={`${label}: ${count} (${pct.toFixed(1)}%)`}
            >
              {pct >= 10 && (
                <span className={`text-[9px] font-semibold ${text} leading-none px-0.5 truncate`}>
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* leyenda sub */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
        {subSegments.filter(({ count }) => count > 0).map(({ key, dot, label, count, pct }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-sm ${dot} inline-block shrink-0 border border-border`} />
            <span className="font-medium text-foreground">{label}</span>
            <span>{count} · {pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── skeleton ─────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-3 mt-2 animate-pulse">
      <div className="h-8 w-full bg-gray-200 dark:bg-slate-700 rounded-md" />
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
        ))}
      </div>
      <div className="h-5 w-3/4 bg-gray-200 dark:bg-slate-700 rounded mt-4" />
    </div>
  );
}

/* ── componente principal ─────────────────────────────── */
interface Props {
  storeId: string;
  range:   DateRange;
}

export function CcDistribucionBar({ storeId, range }: Props) {
  const { data, isLoading, isError } = useCcKpisFunnel(storeId, range);

  return (
    <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-800/50">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Distribución de estados COD
          </CardTitle>
          {data?.distribucion && !isLoading && (
            <CuadreBadge dist={data.distribucion} />
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {isError && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Error al cargar la distribución. Intentá de nuevo.
          </p>
        )}

        {isLoading && <Skeleton />}

        {!isLoading && !isError && !data?.distribucion && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin datos de distribución para el período.
          </p>
        )}

        {!isLoading && !isError && data?.distribucion && data.distribucion.total > 0 && (
          <>
            <BarraPrincipal dist={data.distribucion} />
            {data.subBreakdown && (
              <SubBarraConfirmado dist={data.distribucion} sub={data.subBreakdown} />
            )}
          </>
        )}

        {!isLoading && !isError && data?.distribucion && data.distribucion.total === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin pedidos en el período seleccionado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
