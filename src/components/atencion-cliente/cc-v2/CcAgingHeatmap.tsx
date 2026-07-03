"use client";

import { DateRange } from "react-day-picker";
import { useCcAging } from "@/hooks/useCcAging";
import { CcAgingDiasBuckets, CcAgingEstadoRow } from "@/interfaces/IOrder";
import { AlertTriangle } from "lucide-react";

/* ── constantes ─────────────────────────────────────────── */

/** Columnas de día en orden: índice = nivel de calor (0-6). */
const DIAS_COLS: { key: keyof CcAgingDiasBuckets; label: string; heatLevel: number }[] = [
  { key: "d0",    label: "0d",  heatLevel: 0 },
  { key: "d1",    label: "1d",  heatLevel: 1 },
  { key: "d2",    label: "2d",  heatLevel: 2 },
  { key: "d3",    label: "3d",  heatLevel: 3 },
  { key: "d4",    label: "4d",  heatLevel: 4 },
  { key: "d5",    label: "5d",  heatLevel: 5 },
  { key: "d6plus",label: "6d+", heatLevel: 6 },
];

const ESTADO_LABELS: Record<CcAgingEstadoRow["estado"], string> = {
  PENDIENTE:   "Pendiente",
  NO_CONTESTA: "No contesta",
  DESPACHADO:  "Despachado",
};

/* ── paleta semáforo por nivel de calor ─────────────────── */
// heatLevel: 0-1 → normal, 2 → atención, 3 → urgente, 4-5 → crítico, 6 → crítico intenso
function heatClasses(heatLevel: number, count: number): string {
  const muted = count === 0;

  if (heatLevel <= 1) {
    return muted
      ? "bg-slate-50 text-slate-300 dark:bg-slate-800/30 dark:text-slate-600"
      : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (heatLevel === 2) {
    return muted
      ? "bg-slate-50 text-slate-300 dark:bg-slate-800/30 dark:text-slate-600"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  }
  if (heatLevel === 3) {
    return muted
      ? "bg-slate-50 text-slate-300 dark:bg-slate-800/30 dark:text-slate-600"
      : "bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300";
  }
  if (heatLevel <= 5) {
    return muted
      ? "bg-slate-50 text-slate-300 dark:bg-slate-800/30 dark:text-slate-600"
      : "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300";
  }
  // heatLevel >= 6
  return muted
    ? "bg-slate-50 text-slate-300 dark:bg-slate-800/30 dark:text-slate-600"
    : "bg-red-400 text-white dark:bg-red-700 dark:text-red-100";
}

/* ── fila del heatmap ───────────────────────────────────── */
function AgingRow({ row }: { row: CcAgingEstadoRow }) {
  return (
    <tr className="group">
      {/* Etiqueta de estado */}
      <td className="py-2 pr-3 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap select-none">
        {ESTADO_LABELS[row.estado]}
      </td>

      {/* Celdas de días */}
      {DIAS_COLS.map(({ key, heatLevel }) => {
        const count = row.dias[key];
        return (
          <td key={key} className="px-1 py-1">
            <div
              className={`
                flex items-center justify-center
                rounded-md h-9 w-12 text-sm font-semibold
                transition-opacity
                ${heatClasses(heatLevel, count)}
              `}
            >
              {count === 0 ? (
                <span className="text-xs font-normal">—</span>
              ) : (
                count
              )}
            </div>
          </td>
        );
      })}

      {/* Total por fila */}
      <td className="pl-3 py-1 text-right">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {row.total}
        </span>
      </td>
    </tr>
  );
}

/* ── skeleton ───────────────────────────────────────────── */
function AgingHeatmapSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-5 w-48 rounded bg-slate-100 dark:bg-slate-800" />
      <div className="overflow-x-auto">
        <div className="h-36 rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

/* ── componente principal ───────────────────────────────── */
interface Props {
  storeId: string;
  range: DateRange;
}

export function CcAgingHeatmap({ storeId, range }: Props) {
  const { data, isLoading, isError } = useCcAging(storeId, range);

  /* ── empty state: todos los conteos en 0 ── */
  const allZero =
    data?.estados.every((row) =>
      Object.values(row.dias).every((v) => v === 0),
    ) ?? false;

  /* ── header section ── */
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
        Aging de pedidos activos
      </h3>

      {data && (
        <span
          className={`
            inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold
            ${
              data.zonaCriticaTotal > 0
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }
          `}
        >
          {data.zonaCriticaTotal > 0 && (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          )}
          Zona crítica: {data.zonaCriticaTotal}
        </span>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {header}
        <AgingHeatmapSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        {header}
        <p className="text-sm text-red-500 dark:text-red-400">
          Error al cargar el aging de pedidos. Intentá de nuevo.
        </p>
      </div>
    );
  }

  if (!data || allZero) {
    return (
      <div className="space-y-3">
        {header}
        <p className="text-sm text-muted-foreground">
          Sin pedidos activos en el período seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {header}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50">
        <table className="min-w-full text-center">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {/* Esquina vacía */}
              <th className="py-2 pr-3 text-left" />

              {/* Cabeceras de días */}
              {DIAS_COLS.map(({ key, label, heatLevel }) => (
                <th
                  key={key}
                  className={`
                    px-1 py-2 text-xs font-semibold whitespace-nowrap
                    ${
                      heatLevel <= 1
                        ? "text-slate-500 dark:text-slate-400"
                        : heatLevel === 2
                        ? "text-amber-600 dark:text-amber-400"
                        : heatLevel === 3
                        ? "text-orange-600 dark:text-orange-400"
                        : heatLevel <= 5
                        ? "text-red-600 dark:text-red-400"
                        : "text-red-700 dark:text-red-300"
                    }
                  `}
                >
                  {label}
                </th>
              ))}

              {/* Cabecera total */}
              <th className="pl-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {data.estados.map((row) => (
              <AgingRow key={row.estado} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda semáforo */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-100 dark:bg-emerald-950/40" />
          0-1d normal
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-amber-100 dark:bg-amber-900/40" />
          2d atención
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-orange-200 dark:bg-orange-900/50" />
          3d urgente
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-red-200 dark:bg-red-900/50" />
          4-5d crítico
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-red-400 dark:bg-red-700" />
          6d+ crítico intenso
        </span>
      </div>
    </div>
  );
}
