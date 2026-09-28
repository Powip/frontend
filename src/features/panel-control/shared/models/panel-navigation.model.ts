import type { PanelCapability } from "./panel-role.model";

export const PANEL_TAB_IDS = [
  "resumen",
  "canales",
  "callcenter",
  "operaciones",
  "finanzas",
  "equipo",
  "misventas",
  "configuracion",
] as const;

export type PanelTabId = (typeof PANEL_TAB_IDS)[number];

export type CanalesSubtabId = "canales" | "productos" | "publicidad" | "clientes";
export type OperacionesSubtabId = "cola" | "couriers" | "inventario";
export type FinanzasSubtabId = "resultado" | "caja" | "cobranza";
export type EquipoSubtabId = "vendedoras" | "confirmadoras";
export type ConfiguracionSubtabId = "canales" | "metas" | "estados" | "cuadres" | "desarrollo";

export type PanelSubtabId =
  | CanalesSubtabId
  | OperacionesSubtabId
  | FinanzasSubtabId
  | EquipoSubtabId
  | ConfiguracionSubtabId;

export interface PanelSubtabDefinition {
  id: PanelSubtabId;
  label: string;
  capability?: PanelCapability;
}

export interface PanelTabDefinition {
  id: PanelTabId;
  label: string;
  mobileLabel: string;
  titulo: string;
  subtitulo: string;
  moduloRelacionado: { label: string; href: string } | null;
  subtabs: PanelSubtabDefinition[];
}

export interface PanelNavigation {
  tab: PanelTabId | null;
  subtab: PanelSubtabId | null;
}
