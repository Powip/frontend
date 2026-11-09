"use client";

import { useState } from "react";
import type { VentaDiaria } from "@/features/panel-control/resumen/models/resumen.model";
import {
  descripcionDia,
  METRICAS_VENTA_DIARIA,
  type MetricaVentaDiaria,
  totalesDelPeriodo,
  valorDeMetrica,
} from "@/features/panel-control/resumen/utils/ventas-diarias-metricas";
import {
  formatDayKey,
  formatNumber,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { SegmentedControl } from "../SegmentedControl";
import { BarChart } from "./BarChart";

interface VentasDiariasChartProps {
  dias: VentaDiaria[];
  /** Nombre del gráfico para lectores de pantalla; se le agrega la métrica elegida. */
  ariaLabel: string;
  /** El periodo anterior trae días equivalentes (la línea punteada solo se dibuja para facturación). */
  conComparacion: boolean;
  onSelectDia: (dia: string) => void;
  height?: number;
  width?: number;
}

/**
 * «Ventas diarias»: un solo gráfico con selector de métrica (Facturación, Pedidos, Unidades, Ticket
 * promedio). No mezcla métricas en las mismas barras porque sus escalas difieren en órdenes de magnitud
 * (soles contra unidades); cada día, sea cual sea la métrica, describe las cuatro cifras en su tooltip.
 */
export function VentasDiariasChart({
  dias,
  ariaLabel,
  conComparacion,
  onSelectDia,
  height = 260,
  width = 620,
}: VentasDiariasChartProps) {
  const [metrica, setMetrica] = useState<MetricaVentaDiaria>("facturacion");
  const definicion =
    METRICAS_VENTA_DIARIA.find((m) => m.id === metrica) ?? METRICAS_VENTA_DIARIA[0];
  const lineaAnterior = conComparacion && metrica === "facturacion";
  const totales = totalesDelPeriodo(dias);

  return (
    <div className="space-y-2">
      <SegmentedControl
        ariaLabel="Métrica del gráfico"
        value={metrica}
        onChange={setMetrica}
        options={METRICAS_VENTA_DIARIA.map((m) => ({ value: m.id, label: m.etiqueta }))}
      />
      <ul className="flex flex-wrap gap-3 text-xs text-pc-text-muted" aria-label="Leyenda">
        <li className="inline-flex items-center gap-1.5">
          <i
            aria-hidden
            className="inline-block size-2.5 rounded-sm"
            style={{ background: "var(--pc-series-1)" }}
          />
          {definicion.etiqueta}
        </li>
        {lineaAnterior && (
          <li className="inline-flex items-center gap-1.5">
            <i
              aria-hidden
              className="inline-block h-0.5 w-4 border-t-2 border-dashed border-pc-text-soft"
            />
            Periodo anterior (misma antigüedad)
          </li>
        )}
      </ul>
      <BarChart
        ariaLabel={`${ariaLabel} · ${definicion.etiqueta}`}
        formatAxis={definicion.formatAxis}
        height={height}
        width={width}
        data={dias.map((dia) => ({
          key: dia.dia,
          label: dias.length > 2 ? String(Number(dia.dia.slice(8))) : formatDayKey(dia.dia),
          value: valorDeMetrica(dia, metrica),
          comparison: lineaAnterior ? dia.facturacionAnterior : null,
          description: descripcionDia(dia, conComparacion),
          onSelect: () => onSelectDia(dia.dia),
        }))}
      />
      <p className="text-xs text-pc-text-muted">
        Total {formatSoles(totales.facturacion)} · {formatNumber(totales.ventas)} ventas ·{" "}
        {formatNumber(totales.unidades)} unidades · ticket {formatSoles(totales.ticket)}
      </p>
      {conComparacion && !lineaAnterior && (
        <p
          role="note"
          className="rounded-lg bg-pc-surface-muted px-2.5 py-1.5 text-xs text-pc-text-muted"
        >
          La línea del periodo anterior solo existe para facturación.
        </p>
      )}
    </div>
  );
}
