import type { PeriodPreset } from "./panel-filters.model";

export const PANEL_TIME_ZONE = "America/Lima";

export interface PanelPeriod {
  preset: PeriodPreset;
  desde: string;
  hasta: string;
  anteriorDesde: string;
  anteriorHasta: string;
  desfaseDias: number;
  dias: number;
  diasTranscurridos: number;
  incluyeHoy: boolean;
  hoy: string;
  /** Zona IANA en la que se cuentan los días (la del navegador; Lima por defecto). */
  zonaHoraria: string;
}
