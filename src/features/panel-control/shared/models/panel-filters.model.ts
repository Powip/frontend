export const PERIOD_PRESETS = [
  "hoy",
  "ayer",
  "7d",
  "mes",
  "mes_anterior",
  "personalizado",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const ENTRADAS_CANAL = ["lead", "directa", "presencial"] as const;
export type EntradaCanal = (typeof ENTRADAS_CANAL)[number];

export const COBROS_CANAL = ["cod", "pre", "inm", "mkp"] as const;
export type CobroCanal = (typeof COBROS_CANAL)[number];

export const ZONAS_PANEL = ["lima", "provincia"] as const;
export type ZonaPanel = (typeof ZONAS_PANEL)[number];

export const TURNOS_PANEL = ["express", "general"] as const;
export type TurnoPanel = (typeof TURNOS_PANEL)[number];

export const SIN_ASESOR = "sin_asesor";

export interface PanelDimensionFilters {
  tiendaId: string | null;
  canalId: string | null;
  entrada: EntradaCanal | null;
  cobro: CobroCanal | null;
  zona: ZonaPanel | null;
  turno: TurnoPanel | null;
  asesorId: string | null;
}

export type DimensionFilterKey = keyof PanelDimensionFilters;

export interface PanelDateRangeSelection {
  desde: string;
  hasta: string;
}

export interface PanelPeriodSelection {
  preset: PeriodPreset;
  personalizado: PanelDateRangeSelection | null;
}

export interface PanelFilters extends PanelDimensionFilters {
  periodo: PanelPeriodSelection;
}

export interface ActiveFilterChip {
  key: DimensionFilterKey;
  label: string;
  value: string;
  bloqueado: boolean;
}
