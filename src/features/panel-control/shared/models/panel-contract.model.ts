import type { PanelTabId } from "./panel-navigation.model";
import type { PanelCapability, PanelRole } from "./panel-role.model";

export const PANEL_CONTRACT_IDS = [
  "estado-periodo",
  "resumen",
  "canales-fichas",
  "canales-fichas-guardar",
  "canales-comparativo",
  "canales-detalle",
  "productos",
  "publicidad",
  "clientes-zonas",
  "callcenter",
  "operaciones-cola",
  "operaciones-couriers",
  "operaciones-inventario",
  "finanzas-resultado",
  "finanzas-caja",
  "finanzas-cobranza",
  "equipo-vendedoras",
  "equipo-confirmadoras",
  "mis-ventas",
  "config-metas",
  "config-metas-guardar",
  "config-estados",
  "config-cuadres",
  "detalle",
  "acciones-pedido",
  "exportacion-libro",
  "compartir-reporte",
  "opciones-asesores",
] as const;

export type PanelContractId = (typeof PANEL_CONTRACT_IDS)[number];

export type ContractIntegrationStatus = "conectado" | "parcial" | "pendiente";

export type ContractFilterKey =
  | "desde"
  | "hasta"
  | "anterior_desde"
  | "anterior_hasta"
  | "zona_horaria"
  | "tienda"
  | "canal"
  | "entrada"
  | "cobro"
  | "zona"
  | "turno"
  | "asesor"
  | "ver_como";

export interface PanelContractDescriptor {
  id: PanelContractId;
  titulo: string;
  metodo: "GET" | "PUT" | "POST";
  endpoint: string;
  endpointActual: string | null;
  estado: ContractIntegrationStatus;
  pantallas: PanelTabId[];
  filtros: ContractFilterKey[];
  roles: PanelRole[];
  capacidadRequerida: PanelCapability | null;
  camposRestringidos: string[];
  respuesta: string;
  pendientes: string[];
}

export const PANEL_FILTROS_GLOBALES: ContractFilterKey[] = [
  "desde",
  "hasta",
  "anterior_desde",
  "anterior_hasta",
  "zona_horaria",
  "tienda",
  "canal",
  "entrada",
  "cobro",
  "zona",
  "turno",
  "asesor",
  "ver_como",
];
