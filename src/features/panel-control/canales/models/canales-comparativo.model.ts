import type { CanalFicha } from "./canal-ficha.model";

export const VISTAS_COMPARATIVO = ["ventas", "entregas", "ganancia"] as const;
export type VistaComparativo = (typeof VISTAS_COMPARATIVO)[number];

export interface CanalVentasFila {
  canalId: string | null;
  leads: number | null;
  confirmacion: number | null;
  ventas: number;
  facturacion: number;
  participacion: number | null;
  unidades: number;
  ticket: number | null;
  descuentos: number;
  upsell: number;
  metaPeriodo: number | null;
  avanceMeta: number | null;
}

export interface CanalEntregasFila {
  canalId: string | null;
  ventas: number;
  enCurso: number;
  entregados: number;
  rechazados: number;
  efectividadEntrega: number | null;
  primerIntento: number | null;
  flete?: number;
  pagado: number;
  porCobrar: number;
  perdido: number;
}

export interface CanalGananciaFila {
  canalId: string | null;
  facturacion: number;
  entregado: number;
  costoProducto: number;
  costoIncompleto: boolean;
  pautaDirecta: number;
  pautaGeneralEstimada: number;
  comision: number;
  flete: number;
  ganancia: number;
  gananciaParcial: boolean;
  margen: number | null;
  retornoPublicidad: number | null;
  costoPorVenta: number | null;
}

export interface CanalesComparativoQueryExtra {
  vista: VistaComparativo;
}

export interface TendenciaSemanalSerie {
  familia: string;
  agrupada: boolean;
  familiasIncluidas: string[];
  valores: { semanaDesde: string; facturacion: number }[];
}

type Totales<T> = Omit<T, "canalId">;

interface ComparativoBase {
  canales: CanalFicha[];
  tendencia: TendenciaSemanalSerie[];
  semanaEnCurso: string | null;
}

export type CanalesComparativo = ComparativoBase &
  (
    | { vista: "ventas"; filas: CanalVentasFila[]; total: Totales<CanalVentasFila> }
    | { vista: "entregas"; filas: CanalEntregasFila[]; total: Totales<CanalEntregasFila> }
    | { vista: "ganancia"; filas: CanalGananciaFila[]; total: Totales<CanalGananciaFila> }
  );
