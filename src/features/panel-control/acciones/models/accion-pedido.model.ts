export const ACCIONES_PEDIDO = [
  "llamar",
  "asignar_guia",
  "pedir_liquidacion",
  "avisar_cliente",
  "reclamar_courier",
  "completar_motivo",
  "preparar",
  "coordinar_recojo",
  "asignar_canal",
] as const;

export type AccionPedidoId = (typeof ACCIONES_PEDIDO)[number];

export const ACCION_PEDIDO_LABEL: Record<AccionPedidoId, string> = {
  llamar: "Llamar ahora",
  asignar_guia: "Asignar guía",
  pedir_liquidacion: "Pedir liquidación",
  avisar_cliente: "Avisar al cliente",
  reclamar_courier: "Reclamar al courier",
  completar_motivo: "Completar motivo",
  preparar: "Preparar",
  coordinar_recojo: "Coordinar recojo",
  asignar_canal: "Asignar canal",
};

export interface AccionPedidoRequest {
  accion: AccionPedidoId;
  pedidoIds: string[];
  motivo?: string;
  canalId?: string;
}

export interface AccionPedidoResponse {
  procesados: string[];
  rechazados: { pedidoId: string; motivo: string }[];
}
