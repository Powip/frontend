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
  /** Solo Dueño (la clave se omite sin `ver_costos`). `null` = ningún envío tiene flete informado: «Sin dato», nunca 0. */
  fletePromedio?: number | null;
  fleteTotal?: number | null;
  /** Envíos sin flete informado (quedan fuera del promedio y del total). Se omite junto con los demás costos. */
  enviosSinFlete?: number;
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
  /** `null` si ninguno de sus envíos tiene flete informado. */
  fleteTotal?: number | null;
  /** 0 si no tiene rechazados; `null` si los tiene y ninguno tiene flete informado. */
  costoRechazos?: number | null;
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
