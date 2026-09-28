import type { CanalFicha } from "./canal-ficha.model";

export interface CanalDetalleKpis {
  leads: number | null;
  confirmacion: number | null;
  ventas: number;
  facturacion: number;
  participacion: number | null;
  metaPeriodo: number | null;
  avanceMeta: number | null;
  ticket: number | null;
  unidades: number;
  efectividadEntrega: number | null;
  cobradoEnCaja: number | null;
}

export interface CanalDetalleCostos {
  pautaDirecta: number;
  pautaGeneralEstimada: number;
  publicidad: number;
  comision: number;
  flete: number;
  costoCanal: number;
  ganancia: number;
  gananciaParcial: boolean;
  margen: number | null;
  retornoPublicidad: number | null;
}

export type EtapaEmbudo = "recibidos" | "contactados" | "llamados" | "entregados";

export interface EmbudoLeadEtapa {
  etapa: EtapaEmbudo;
  pedidos: number;
}

export interface MotivoPerdida {
  tipo: "anulado" | "rechazado";
  motivo: string;
  pedidos: number;
}

export interface SesionLive {
  sesionId: string;
  tiendaId: string;
  inicio: string;
  fin: string;
  inversion: number;
  leads: number;
  llamados: number;
  confirmacion: number | null;
  facturacion: number;
  retorno: number | null;
  costoPorVenta: number | null;
  cerradosPorOtroCanal: number;
}

export interface CierreCajaDia {
  dia: string;
  tickets: number;
  porMetodo: Record<string, number>;
  total: number;
  ticketPromedio: number | null;
}

export interface VendedoraCanalFila {
  asesorId: string | null;
  asesorNombre: string;
  ventas: number;
  facturacion: number;
  ticket: number | null;
  tasaUpsell: number | null;
  efectividadEntrega: number | null;
  pagado: number;
}

export type CanalBloqueEspecifico =
  | { tipo: "lead"; embudo: EmbudoLeadEtapa[]; perdidas: MotivoPerdida[] }
  | { tipo: "live"; sesiones: SesionLive[] }
  | { tipo: "presencial"; metodos: string[]; cierres: CierreCajaDia[] }
  | {
      tipo: "marketplace";
      porLiquidarBruto: number;
      pedidosPorLiquidar: number;
      comisionADescontar?: number;
      netoARecibir?: number;
      plazoDias: number | null;
    }
  | {
      tipo: "prepago";
      cobrado: number;
      pasarela?: number;
      reembolsos: number;
      pedidosReembolsados: number;
    }
  | { tipo: "conversacional"; vendedoras: VendedoraCanalFila[] };

export interface CanalDetalle {
  ficha: CanalFicha;
  kpis: CanalDetalleKpis;
  costos?: CanalDetalleCostos;
  bloque: CanalBloqueEspecifico;
}
