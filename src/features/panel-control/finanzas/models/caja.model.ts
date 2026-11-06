export const FUENTES_INGRESO_CAJA = [
  "liquidacion_courier",
  "liquidacion_marketplace",
  "caja_pos",
  "prepago",
  "adelantos",
] as const;
export type FuenteIngresoCaja = (typeof FUENTES_INGRESO_CAJA)[number];

export const CONCEPTOS_EGRESO_CAJA = [
  "publicidad",
  "fletes",
  "pasarela",
  "comisiones_aliados",
  "reembolsos",
  "gastos_fijos",
] as const;
export type ConceptoEgresoCaja = (typeof CONCEPTOS_EGRESO_CAJA)[number];

export interface CajaMovimiento<T extends string> {
  concepto: T;
  monto: number | null;
  pedidos: number | null;
}

export interface CajaDia {
  dia: string;
  entro: number;
  salio: number;
}

export interface CajaPanel {
  entradas: CajaMovimiento<FuenteIngresoCaja>[];
  salidas: CajaMovimiento<ConceptoEgresoCaja>[];
  totalEntro: number;
  totalSalio: number;
  netoCaja: number;
  promedioDiarioEntra: number | null;
  dias: number;
  porDia: CajaDia[];
  incluyeComprasMercaderia: false;
}

/**
 * R22: `liquidacion_courier` conserva su nombre de contrato, pero su fecha es la del REGISTRO del pago
 * (no hay liquidaciones de courier en el backend): el rótulo nunca dice «fecha de liquidación».
 */
export const FUENTE_INGRESO_LABEL: Record<FuenteIngresoCaja, string> = {
  liquidacion_courier: "Cobro por contraentrega (fecha de registro del pago)",
  liquidacion_marketplace: "Cobro de marketplace (neto de comisión)",
  caja_pos: "Caja POS",
  prepago: "Prepago (pasarela)",
  adelantos: "Adelantos (Yape antes del envío)",
};

export const CONCEPTO_EGRESO_LABEL: Record<ConceptoEgresoCaja, string> = {
  publicidad: "Publicidad",
  fletes: "Fletes pagados",
  pasarela: "Comisión de pasarela",
  comisiones_aliados: "Comisiones de plataformas aliadas",
  reembolsos: "Reembolsos de prepago",
  gastos_fijos: "Gastos fijos (prorrateados)",
};
