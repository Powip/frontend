import type { AccionPedidoId } from "../../acciones/models/accion-pedido.model";
import type { EstadoPanel } from "../../shared/models/estado-pedido.model";

export interface ColaKpis {
  colaActiva: number;
  sinGuiaMas24h: number;
  enviosRetrasados: number;
  enviosSinTiempoNormal: number;
  diasConfirmadoAEntregado: number | null;
  entregasMedidas: number;
  entregados: number;
  rechazados: number;
  incidenciaRechazo: number | null;
}

export const BUCKETS_ANTIGUEDAD = ["menos_24h", "1_2d", "3_5d", "mas_5d"] as const;
export type BucketAntiguedad = (typeof BUCKETS_ANTIGUEDAD)[number];

export const BUCKET_ANTIGUEDAD_LABEL: Record<BucketAntiguedad, string> = {
  menos_24h: "< 24 h",
  "1_2d": "1 – 2 días",
  "3_5d": "3 – 5 días",
  mas_5d: "+5 días",
};

export const ESTADOS_COLA = ["LLAMADO", "PREPARADO", "CON_GUIA", "EN_ENVIO"] as const;
export type EstadoCola = Extract<EstadoPanel, (typeof ESTADOS_COLA)[number]>;

export const ACCION_POR_ESTADO_COLA: Record<EstadoCola, AccionPedidoId> = {
  LLAMADO: "preparar",
  PREPARADO: "asignar_guia",
  CON_GUIA: "coordinar_recojo",
  EN_ENVIO: "reclamar_courier",
};

export interface ColaMatrizFila {
  estado: EstadoCola;
  accion: AccionPedidoId;
  porAntiguedad: Record<BucketAntiguedad, number>;
  total: number;
  sinFecha: number;
}

export const ETAPAS_OPERATIVAS = [
  "llamado_preparado",
  "preparado_con_guia",
  "con_guia_en_envio",
  "en_envio_entregado",
  "ciclo_total",
] as const;
export type EtapaOperativa = (typeof ETAPAS_OPERATIVAS)[number];

export const ETAPA_OPERATIVA_LABEL: Record<EtapaOperativa, string> = {
  llamado_preparado: "Llamado → Preparado",
  preparado_con_guia: "Preparado → Con guía",
  con_guia_en_envio: "Con guía → En envío",
  en_envio_entregado: "En envío → Entregado",
  ciclo_total: "Ciclo total (confirmado → entregado)",
};

export interface TiempoEtapaFila {
  etapa: EtapaOperativa;
  medianaHoras: number | null;
  metaHoras: number | null;
  pedidosMedidos: number;
  sobreMeta: number;
  sinFechas: number;
}

export interface DespachoDia {
  dia: string;
  despachados: number;
}

export interface MotivoRechazoFila {
  motivo: string;
  sinMotivo: boolean;
  pedidos: number;
}

export interface ColaPanel {
  kpis: ColaKpis;
  matriz: ColaMatrizFila[];
  tiemposPorEtapa: TiempoEtapaFila[];
  despachosPorDia: DespachoDia[];
  motivosRechazo: MotivoRechazoFila[];
}
