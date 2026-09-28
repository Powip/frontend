export interface CobranzaKpis {
  porLiquidar: number;
  pedidosPorLiquidar: number;
  vencido: number;
  pedidosVencidos: number;
  enCurso: number;
  pedidosEnCurso: number;
  adelantosDeNoEntregadas: number | null;
  porLiquidarSinPlazo: number;
}

export interface LiquidacionPendienteFila {
  courierId: string;
  courier: string;
  plazoDias: number | null;
  pedidos: number;
  monto: number;
  diasMasAntiguo: number;
  vencido: number | null;
}

export const BUCKETS_DEUDA = ["0_3d", "4_7d", "8_14d", "mas_14d"] as const;
export type BucketDeuda = (typeof BUCKETS_DEUDA)[number];

export interface AntiguedadDeudaFila {
  bucket: BucketDeuda;
  monto: number;
  pedidos: number;
}

export interface CobranzaPanel {
  kpis: CobranzaKpis;
  liquidacionesPendientes: LiquidacionPendienteFila[];
  antiguedad: AntiguedadDeudaFila[];
}

export const BUCKET_DEUDA_LABEL: Record<BucketDeuda, string> = {
  "0_3d": "0 – 3 días",
  "4_7d": "4 – 7 días",
  "8_14d": "8 – 14 días",
  mas_14d: "Más de 14 días",
};
