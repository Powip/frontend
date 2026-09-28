export interface EstadoPeriodo {
  pedidosPeriodo: number;
  pedidosAbiertos: number;
  porcentajeAbierto: number | null;
  calidad?: {
    datosCompletos: number | null;
    cuadresOk: number;
    cuadresTotal: number;
  };
}

export const UMBRAL_PERIODO_ABIERTO = 0.25;
