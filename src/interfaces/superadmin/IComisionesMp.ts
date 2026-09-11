/* -----------------------------------------
   Cobranza MP — comisión 0.5% sobre pagos Mercado Pago, cuentas
   conectadas por negocio y liquidaciones del modo powip_temporal.

   Nace de POWIP_Hito1_Especificacion.md (Cobranza Digital + Operación
   de Entrega) — §5.4 (mp_accounts / mp_transactions), §5.7
   (comision_config / liquidaciones) y §8 (endpoints Super Admin).
   Es un módulo de negocio DISTINTO a Partners (comisiones de referidos,
   ver IPartner.ts) y a Finanzas POWIP (MRR/facturación SaaS, ver
   IFinanzas.ts): acá la "comisión" es el 0.5% que Powip cobra sobre CADA
   pago que un negocio cliente procesa con Mercado Pago, no lo que Powip
   le paga a un partner ni lo que le cobra a la empresa por su plan.

   Ver docs/superadmin/cobranza-mp-endpoints.md.
----------------------------------------- */
export type ModoCuentaMp = "propia" | "powip_temporal";

/** 5.4 mp_accounts — una cuenta MP por negocio (o su ausencia = powip_temporal). */
export interface ICuentaMp {
  empresaId: string;
  empresaNombre: string;
  mpEmail?: string;
  modo: ModoCuentaMp;
  activa: boolean;
  /** Yape dentro de Mercado Pago — método más del Checkout, SÍ genera 0.5%. */
  yapeMpActivo: boolean;
  /** Yape directo al número del negocio — manual, requiere validar comprobante, 0% comisión. */
  yapeDirectoActivo: boolean;
  conectadaEn?: string;
}

export type FuenteComisionMp = "Cobros deuda link" | "Upsell pre-despacho" | "Catálogo / recompra";

/** Distribución de la comisión del mes por origen del cobro (spec §12, panel Super Admin). */
export interface IComisionFuenteMp {
  fuente: FuenteComisionMp;
  pct: number;
}

/** Comisión 0.5% acumulada por negocio en el período — GET /admin/comisiones/por-negocio. */
export interface IComisionEmpresaMp {
  empresaId: string;
  empresaNombre: string;
  modo: ModoCuentaMp;
  gmvMp: number;
  comisionPct: number;
  comisionMonto: number;
}

export type EstadoLiquidacionMp = "pendiente" | "pagada";

/** 5.7 liquidaciones — solo aplica a negocios en modo powip_temporal (sin cuenta MP propia). */
export interface ILiquidacionMp {
  id: string;
  empresaId: string;
  empresaNombre: string;
  periodo: string;
  montoBruto: number;
  comisionPowip: number;
  neto: number;
  estado: EstadoLiquidacionMp;
  nroOperacion?: string;
  ejecutadaEn?: string;
}
