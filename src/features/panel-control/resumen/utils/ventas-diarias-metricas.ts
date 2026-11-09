import { axisNumber, axisSoles } from "@/features/panel-control/shared/utils/chart";
import {
  formatDayKey,
  formatNumber,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import type { VentaDiaria } from "../models/resumen.model";

/** Lo que el gráfico «Ventas diarias» puede mostrar en sus barras. */
export type MetricaVentaDiaria = "facturacion" | "pedidos" | "unidades" | "ticket";

export interface DefinicionMetricaVentaDiaria {
  id: MetricaVentaDiaria;
  etiqueta: string;
  formatAxis: (valor: number) => string;
}

export const METRICAS_VENTA_DIARIA: DefinicionMetricaVentaDiaria[] = [
  { id: "facturacion", etiqueta: "Facturación", formatAxis: axisSoles },
  { id: "pedidos", etiqueta: "Pedidos", formatAxis: axisNumber },
  { id: "unidades", etiqueta: "Unidades", formatAxis: axisNumber },
  { id: "ticket", etiqueta: "Ticket promedio", formatAxis: axisSoles },
];

/** Facturación ÷ pedidos del día; null si no hubo ventas (no se inventa un ticket). */
export function ticketDelDia(dia: Pick<VentaDiaria, "facturacion" | "ventas">): number | null {
  return dia.ventas > 0 ? dia.facturacion / dia.ventas : null;
}

/** Altura de la barra: un día sin ventas vale 0 en todas las métricas. */
export function valorDeMetrica(dia: VentaDiaria, metrica: MetricaVentaDiaria): number {
  switch (metrica) {
    case "facturacion":
      return dia.facturacion;
    case "pedidos":
      return dia.ventas;
    case "unidades":
      return dia.unidades;
    case "ticket":
      return ticketDelDia(dia) ?? 0;
  }
}

/** Texto de la barra (tooltip y lector de pantalla): siempre las cuatro cifras del día. */
export function descripcionDia(dia: VentaDiaria, conComparacion = false): string {
  const base = `${formatDayKey(dia.dia)}: ${formatSoles(dia.facturacion)} · ${formatNumber(dia.ventas)} ventas · ${formatNumber(dia.unidades)} unidades · ticket ${formatSoles(ticketDelDia(dia))}`;
  if (!conComparacion || dia.diaAnterior === null) return base;
  return `${base} · periodo anterior (${formatDayKey(dia.diaAnterior)}): ${formatSoles(dia.facturacionAnterior)}`;
}

export interface TotalesVentasDiarias {
  facturacion: number;
  ventas: number;
  unidades: number;
  ticket: number | null;
}

/** El ticket del periodo sale de los totales, no de promediar los tickets de cada día. */
export function totalesDelPeriodo(dias: VentaDiaria[]): TotalesVentasDiarias {
  const facturacion = dias.reduce((suma, dia) => suma + dia.facturacion, 0);
  const ventas = dias.reduce((suma, dia) => suma + dia.ventas, 0);
  const unidades = dias.reduce((suma, dia) => suma + dia.unidades, 0);
  return { facturacion, ventas, unidades, ticket: ventas > 0 ? facturacion / ventas : null };
}
