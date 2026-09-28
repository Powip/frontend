export type TipoCourier = "api" | "manual" | "propio" | "marketplace";

export const TIPO_COURIER_LABEL: Record<TipoCourier, string> = {
  api: "API",
  manual: "Manual",
  propio: "Propio",
  marketplace: "Marketplace",
};

export type ScoreCourier = "A" | "B" | "C" | "D";

export interface CouriersKpis {
  envios: number;
  entregados: number;
  rechazados: number;
  enTransito: number;
  efectividadEntrega: number | null;
  primerIntento: number | null;
  entregasSinDatoPrimerIntento: number;
  diasEntrega: number | null;
  fletePromedio?: number | null;
  fleteTotal?: number;
  porLiquidar: number;
  pedidosPorLiquidar: number;
  liquidacionVencida: number;
  pedidosVencidos: number;
  porLiquidarSinPlazo: number;
}

export interface CourierFila {
  courierId: string;
  nombre: string;
  tipo: TipoCourier | null;
  plazoLiquidacionDias: number | null;
  tiempoNormalDias: number | null;
  envios: number;
  entregados: number;
  rechazados: number;
  enTransito: number;
  efectividad: number | null;
  primerIntento: number | null;
  diasPromedio: number | null;
  fletePromedio?: number | null;
  fleteTotal?: number;
  costoRechazos?: number;
  porLiquidar: number;
  vencido: number | null;
  score: ScoreCourier | null;
}

export interface EfectividadDepartamentoFila {
  departamento: string;
  envios: number;
  entregados: number;
  rechazados: number;
  efectividad: number | null;
  courierPrincipal: string | null;
  ticket: number | null;
  fletePromedio?: number | null;
}

export interface CouriersPanel {
  kpis: CouriersKpis;
  couriers: CourierFila[];
  departamentos: EfectividadDepartamentoFila[];
}
