"use client";

import { DateRange } from "react-day-picker";
import { useCcIntentos } from "@/hooks/useCcIntentos";
import { CcIntentoBucket } from "@/interfaces/IOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone } from "lucide-react";

/* ── helpers ────────────────────────────────────────────── */

/** Devuelve el insight textual: mejor intento o tendencia decreciente. */
function calcInsight(buckets: CcIntentoBucket[]): string {
  const main = buckets.filter((b) => b.etiqueta !== "3+");
  if (main.length === 0) return "";

  const isDecreasing = main.every(
    (b, i) => i === 0 || b.tasaExito <= main[i - 1].tasaExito,
  );
  if (isDecreasing && main.length > 1) {
    return "La conversión cae del intento 1 al 3. Priorizar llamadas en el 1er intento.";
  }

  const best = main.reduce((prev, cur) =>
    cur.tasaExito > prev.tasaExito ? cur : prev,
  );
  return `El intento #${best.etiqueta} tiene la mayor tasa de éxito (${best.tasaExito.toFixed(1)}%).`;
}

/* ── tarjeta individual de intento ──────────────────────── */
interface IntentoBucketCardProps {
  bucket: CcIntentoBucket;
  label: string;
}

function IntentoBucketCard({ bucket, label }: IntentoBucketCardProps) {
  const total = bucket.totalLlamadas;

  return (
    <Card className="border border-slate-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {label}
          </CardTitle>
          <span className="shrink-0 rounded-full bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
            {bucket.tasaExito.toFixed(1)}% éxito
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {total} llamada{total !== 1 ? "s" : ""}
        </p>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-2">
        {/* Tasa de éxito destacada */}
        <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Tasa de éxito</p>
          <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">
            {bucket.tasaExito.toFixed(1)}%
          </p>
        </div>

        {/* Desglose */}
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <div className="rounded bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 text-center">
            <p className="text-muted-foreground leading-none mb-0.5">Confirm.</p>
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              {bucket.confirmados}
            </p>
          </div>
          <div className="rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 text-center">
            <p className="text-muted-foreground leading-none mb-0.5">No cont.</p>
            <p className="font-semibold text-amber-700 dark:text-amber-300">
              {bucket.noContesta}
            </p>
          </div>
          <div className="rounded bg-red-50 dark:bg-red-950/30 px-2 py-1.5 text-center">
            <p className="text-muted-foreground leading-none mb-0.5">Rechaz.</p>
            <p className="font-semibold text-red-700 dark:text-red-300">
              {bucket.rechazados}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── componente principal ───────────────────────────────── */
interface Props {
  storeId: string;
  range: DateRange;
}

export function CcIntentosCard({ storeId, range }: Props) {
  const { data, isLoading, isError } = useCcIntentos(storeId, range);

  /* Guardas de estado */
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
          Análisis de Intentos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
          Análisis de Intentos
        </h3>
        <p className="text-sm text-red-500 dark:text-red-400">
          Error al cargar datos de intentos. Intentá de nuevo.
        </p>
      </div>
    );
  }

  /* Estado vacío: todos los buckets con 0 llamadas */
  const allEmpty =
    !data || data.intentos.every((b) => b.totalLlamadas === 0);

  if (allEmpty) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
          Análisis de Intentos
        </h3>
        <p className="text-sm text-muted-foreground">
          Sin datos de intentos para el período seleccionado.
        </p>
      </div>
    );
  }

  /* Buckets garantizados por el backend: 1, 2, 3, 3+ */
  const b1  = data.intentos.find((b) => b.etiqueta === "1")!;
  const b2  = data.intentos.find((b) => b.etiqueta === "2")!;
  const b3  = data.intentos.find((b) => b.etiqueta === "3")!;
  const bMas = data.intentos.find((b) => b.etiqueta === "3+")!;

  const insight = calcInsight(data.intentos);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
          Análisis de Intentos
        </h3>
      </div>

      {/* 3 tarjetas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <IntentoBucketCard bucket={b1} label="1er intento" />
        <IntentoBucketCard bucket={b2} label="2do intento" />
        <IntentoBucketCard bucket={b3} label="3er intento" />
      </div>

      {/* Nota de 4to intento o más — solo si tiene datos */}
      {bMas.totalLlamadas > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
            Intentos 4+:
          </span>
          <span>
            {bMas.totalLlamadas} llamada{bMas.totalLlamadas !== 1 ? "s" : ""},{" "}
            {bMas.tasaExito.toFixed(1)}% éxito
            {" · "}
            {bMas.confirmados} confirm. · {bMas.noContesta} no cont. · {bMas.rechazados} rechaz.
          </span>
        </div>
      )}

      {/* Insight automático */}
      {insight && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-sky-400 pl-3">
          {insight}
        </p>
      )}
    </div>
  );
}
