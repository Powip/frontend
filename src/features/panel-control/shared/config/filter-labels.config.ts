import type {
  CobroCanal,
  DimensionFilterKey,
  EntradaCanal,
  PeriodPreset,
  TurnoPanel,
  ZonaPanel,
} from "../models/panel-filters.model";

export const PERIOD_PRESET_LABEL: Record<PeriodPreset, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  "7d": "Últimos 7 días",
  mes: "Mes actual",
  mes_anterior: "Mes anterior",
  personalizado: "Personalizado",
};

export const ENTRADA_LABEL: Record<EntradaCanal, string> = {
  lead: "Lead (se llama para confirmar)",
  directa: "Venta directa",
  presencial: "Presencial (POS)",
};

export const ENTRADA_CHIP_LABEL: Record<EntradaCanal, string> = {
  lead: "Lead",
  directa: "Venta directa",
  presencial: "Presencial",
};

export const COBRO_LABEL: Record<CobroCanal, string> = {
  cod: "Contraentrega",
  pre: "Prepago",
  inm: "Pago inmediato",
  mkp: "Liquidación marketplace",
};

export const ZONA_LABEL: Record<ZonaPanel, string> = {
  lima: "Lima",
  provincia: "Provincia",
};

export const TURNO_LABEL: Record<TurnoPanel, string> = {
  express: "Express",
  general: "General",
};

export const FILTER_KEY_LABEL: Record<DimensionFilterKey, string> = {
  tiendaId: "Tienda",
  canalId: "Canal",
  entrada: "Entrada",
  cobro: "Cobro",
  zona: "Zona",
  turno: "Turno",
  asesorId: "Asesor(a)",
};
