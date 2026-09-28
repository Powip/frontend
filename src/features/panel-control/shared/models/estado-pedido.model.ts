export const ESTADOS_PANEL = [
  "PENDIENTE",
  "LLAMADO",
  "PREPARADO",
  "CON_GUIA",
  "EN_ENVIO",
  "ENTREGADO",
  "PAGADO",
  "ANULADO",
  "RECHAZADO",
] as const;

export type EstadoPanel = (typeof ESTADOS_PANEL)[number];

export type EstadoTono = "ok" | "warn" | "bad" | "info";

export const ESTADOS_COBRO = [
  "pagado",
  "por_liquidar",
  "en_curso",
  "perdido",
  "reembolsado",
  "no_aplica",
] as const;

export type EstadoCobro = (typeof ESTADOS_COBRO)[number];

export interface EstadoPanelDefinicion {
  estado: EstadoPanel;
  etiqueta: string;
  descripcion: string;
  tono: EstadoTono;
  esVenta: boolean;
}
