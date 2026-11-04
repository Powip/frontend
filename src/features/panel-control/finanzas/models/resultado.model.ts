export interface FacturadoAlDinero {
  facturado: number;
  entregado: number;
  pagado: number;
  porLiquidar: number;
  vencido: number | null;
  enCurso: number;
  perdido: number;
  reembolsado: number;
  adelantosRecibidos: number | null;
}

export interface EstadoResultados {
  ventaEntregada: number;
  /** `null` si ninguna entrega tiene costo cargado (no se inventa un 0). */
  costoProducto: number | null;
  entregasSinCosto: number;
  /** Entregas con courier sin flete informado: `envios` suma solo las informadas (R24). */
  entregasSinFlete: number;
  /** Entregas sin comisión calculable (canal sin ficha o sin %): `comisiones` suma solo las informadas (R24). */
  entregasSinComision: number;
  /** `null` mientras no estén conectados Meta/TikTok Ads: se muestra «Pendiente», no 0. */
  publicidadDirecta: number | null;
  publicidadGeneralEstimada: number | null;
  envios: number | null;
  comisiones: number | null;
  /** `null` sin costo, envíos o comisiones informados. Hoy siempre es «antes de publicidad». */
  ganancia: number | null;
  gastosFijos: number | null;
  gastosFijosMensuales: number | null;
  utilidadOperativa: number | null;
  gananciaParcial: boolean;
}

export interface PuntoEquilibrio {
  gananciaPorEntrega: number | null;
  entregasNecesarias: number | null;
  entregasLogradas: number;
  margenSeguridad: number | null;
  fletePromedioPorRechazo: number | null;
}

export interface EvolucionMensualFila {
  mes: string;
  enCurso: boolean;
  facturado: number;
  entregado: number;
  pagado: number;
}

export interface RentabilidadCanalFila {
  canalId: string | null;
  canalNombre: string;
  entregado: number;
  /** `null` mientras no existan costo, pauta y comisión: se muestra «Pendiente». */
  ganancia: number | null;
  gananciaParcial: boolean;
  margen: number | null;
  retornoPublicidad: number | null;
}

export interface ResultadoPanel {
  diasPeriodo: number;
  facturadoAlDinero: FacturadoAlDinero;
  estadoResultados: EstadoResultados;
  puntoEquilibrio: PuntoEquilibrio;
  evolucionMensual: EvolucionMensualFila[];
  rentabilidadPorCanal: RentabilidadCanalFila[];
}
