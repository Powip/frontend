import type { SesionLive } from "../../canales/models/canal-detalle.model";

export interface PublicidadKpis {
  invertido: number;
  pautaDirecta: number;
  pautaGeneralEstimada: number;
  pautaGeneralRegistrada: number;
  pautaGeneralSinAsignar: number;
  retornoPublicidad: number | null;
  ventasEnCanalesConPauta: number;
  facturacionEnCanalesConPauta: number;
  costoPorVenta: number | null;
  porcentajeDeLaVenta: number | null;
  comisionesPlataformas?: number;
}

export interface PublicidadCanalFila {
  canalId: string;
  canalNombre: string;
  pautaDirecta: number;
  pautaGeneralEstimada: number;
  totalInvertido: number;
  comision?: number;
  ventas: number;
  facturacion: number;
  costoPorVenta: number | null;
  retorno: number | null;
  ganancia?: number;
}

export type TipoRegistroPauta = "directa" | "general" | "live";

export interface RegistroPautaDia {
  canalId: string | null;
  canalNombre: string | null;
  tipo: TipoRegistroPauta;
  monto: number;
}

export interface PublicidadDia {
  dia: string;
  invertido: number;
  vendido: number;
  ventas: number;
  costoPorVenta: number | null;
  registros: RegistroPautaDia[];
}

export interface PublicidadPanel {
  canalesConPauta: string[];
  kpis: PublicidadKpis;
  porCanal: PublicidadCanalFila[];
  porDia: PublicidadDia[];
  sesionesLive: SesionLive[];
  inversionNoSeparable: boolean;
}
