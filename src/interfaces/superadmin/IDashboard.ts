/* -----------------------------------------
   8.1 Dashboard — agregados
----------------------------------------- */
export interface IBusinessOverview {
  mrr: number;
  mrrDeltaPct: number;
  clientesActivos: number;
  clientesActivosDeltaPct: number;
  nuevosMes: number;
  churnPct: number;
  churnDeltaPct: number;
  trialsActivos: number;
  conversionTrialPagoPct: number;
  ingresosHoy: number;
  demosHoy: number;
}

export interface ISerieMensual {
  mes: string;
  valor: number;
}

export interface IComposicionClientes {
  /** Etiqueta libre — la define el backend (ver docs/superadmin/dashboard-endpoints.md, #4). */
  segmento: string;
  count: number;
  pct: number;
  color: string;
}

export interface IAlertaImportante {
  id: string;
  texto: string;
  severidad: "info" | "warning" | "critical";
  /** ISO-8601 — el front calcula el "hace X" al renderizar, nunca lo recibe pre-formateado. */
  ts: string;
}

export interface IActividadEvento {
  id: string;
  actorNombre: string;
  actorColor: string;
  accion: string;
  referencia: string;
  /** ISO-8601 — el front calcula el "hace X" al renderizar, nunca lo recibe pre-formateado. */
  ts: string;
}

export interface IClienteEnRiesgo {
  empresaId: string;
  empresaNombre: string;
  motivo: string;
}

export interface IEmbudoEtapa {
  etapa: string;
  count: number;
  pct: number;
  color: string;
}

export interface IAdopcionModulo {
  modulo: string;
  pct: number;
}

export interface ICentroAccionTarea {
  id: string;
  texto: string;
  prioridad: "Alta" | "Media" | "Baja";
  hecho: boolean;
}

export interface ICanalRed {
  canal: string;
  count: number;
  pct: number;
}

export interface IOportunidadProducto {
  titulo: string;
  motivo: string;
}
