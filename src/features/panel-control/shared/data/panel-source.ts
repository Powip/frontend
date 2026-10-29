import type { DataOrigin, PanelDataMode } from "../models/data-origin.model";
import type { PanelCatalogo } from "../models/panel-catalog.model";
import type { PanelContractId } from "../models/panel-contract.model";
import type { PanelTabId } from "../models/panel-navigation.model";
import type { PanelCapability, PanelRole } from "../models/panel-role.model";
import type { ContractQuery, ContractResult } from "./panel-contract-map";
import { PANEL_CONTRACTS } from "./panel-contracts";

export interface PanelSourceContext {
  role: PanelRole;
  capabilities: ReadonlySet<PanelCapability>;
  now: number;
  catalogo: PanelCatalogo;
  asesorAutorizado?: string | null;
}

export interface PanelSource<K extends PanelContractId> {
  contractId: K;
  kind: "real" | "demo";
  descripcion: string;
  /**
   * Pestañas a las que sirve esta fuente; sin valor sirve a todas. Permite que un
   * mismo contrato (p. ej. el detalle de pedidos) sea real donde ya está conectado
   * y demo donde todavía no, sin mostrar pedidos reales detrás de una cifra demo.
   */
  pestanas?: readonly PanelTabId[];
  fetch: (query: ContractQuery<K>, context: PanelSourceContext) => Promise<ContractResult<K>>;
}

export type PanelSourceRegistry = {
  [K in PanelContractId]?: PanelSource<K> | readonly PanelSource<K>[];
};

export interface ResolvedPanelSource<K extends PanelContractId> {
  source: PanelSource<K> | null;
  origin: DataOrigin;
}

export function resolvePanelSource<K extends PanelContractId>(
  registry: PanelSourceRegistry,
  contractId: K,
  mode: PanelDataMode,
  tab?: PanelTabId | null,
): ResolvedPanelSource<K> {
  const descriptor = PANEL_CONTRACTS[contractId];
  const entry = registry[contractId] as PanelSource<K> | readonly PanelSource<K>[] | undefined;
  const candidatas: readonly PanelSource<K>[] =
    entry === undefined ? [] : Array.isArray(entry) ? entry : [entry as PanelSource<K>];
  // Con pestaña activa gana la primera fuente que la sirva; sin ella (tabla de desarrollo) la primera.
  const source = tab
    ? candidatas.find((candidata) => !candidata.pestanas || candidata.pestanas.includes(tab))
    : candidatas[0];

  if (!source) {
    return {
      source: null,
      origin: {
        kind: "pendiente",
        contractId,
        endpoint: `${descriptor.metodo} ${descriptor.endpoint}`,
        detalle: "Sin fuente: el contrato todavía no está disponible en el backend",
      },
    };
  }

  if (source.kind === "demo" && mode === "solo_real") {
    return {
      source: null,
      origin: {
        kind: "pendiente",
        contractId,
        endpoint: `${descriptor.metodo} ${descriptor.endpoint}`,
        detalle: "Oculto en modo «Solo datos reales»: esta vista solo tiene datos demo",
      },
    };
  }

  const endpoint =
    source.kind === "real" && descriptor.endpointActual
      ? descriptor.endpointActual
      : descriptor.endpoint;

  return {
    source,
    origin: {
      kind: source.kind,
      contractId,
      endpoint: `${descriptor.metodo} ${endpoint}`,
      detalle: source.descripcion,
    },
  };
}
