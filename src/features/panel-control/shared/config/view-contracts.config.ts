import type { PanelContractId } from "../models/panel-contract.model";
import type { PanelSubtabId, PanelTabId } from "../models/panel-navigation.model";

const TRANSVERSALES: PanelContractId[] = ["estado-periodo", "detalle", "config-metas"];

type SubtabContracts = Partial<Record<PanelSubtabId, PanelContractId[]>>;

export const VIEW_CONTRACTS: Record<
  PanelTabId,
  { base: PanelContractId[]; subtabs: SubtabContracts }
> = {
  resumen: {
    base: [
      "resumen",
      "acciones-pedido",
      "compartir-reporte",
      "exportacion-libro",
      ...TRANSVERSALES,
    ],
    subtabs: {},
  },
  canales: {
    base: TRANSVERSALES,
    subtabs: {
      canales: ["canales-fichas", "canales-comparativo", "canales-detalle"],
      productos: ["productos"],
      publicidad: ["publicidad"],
      clientes: ["clientes-zonas"],
    },
  },
  callcenter: {
    base: ["callcenter", "acciones-pedido", ...TRANSVERSALES],
    subtabs: {},
  },
  operaciones: {
    base: ["acciones-pedido", ...TRANSVERSALES],
    subtabs: {
      cola: ["operaciones-cola"],
      couriers: ["operaciones-couriers"],
      inventario: ["operaciones-inventario"],
    },
  },
  finanzas: {
    base: TRANSVERSALES,
    subtabs: {
      resultado: ["finanzas-resultado", "canales-comparativo"],
      caja: ["finanzas-caja"],
      cobranza: ["finanzas-cobranza", "acciones-pedido"],
    },
  },
  equipo: {
    base: TRANSVERSALES,
    subtabs: {
      vendedoras: ["equipo-vendedoras"],
      confirmadoras: ["equipo-confirmadoras"],
    },
  },
  misventas: {
    base: ["mis-ventas", ...TRANSVERSALES],
    subtabs: {},
  },
  configuracion: {
    base: ["estado-periodo"],
    subtabs: {
      canales: ["canales-fichas", "canales-fichas-guardar"],
      metas: ["config-metas", "config-metas-guardar"],
      estados: ["config-estados"],
      cuadres: ["config-cuadres"],
      desarrollo: [],
    },
  },
};

export function contractsForView(tab: PanelTabId, subtab: PanelSubtabId | null): PanelContractId[] {
  const definition = VIEW_CONTRACTS[tab];
  const specific = subtab ? (definition.subtabs[subtab] ?? []) : [];
  return [...new Set([...specific, ...definition.base])];
}
