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
  costoProducto: number;
  entregasSinCosto: number;
  publicidadDirecta: number;
  publicidadGeneralEstimada: number;
  envios: number;
  comisiones: number;
  ganancia: number;
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
  ganancia: number;
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
