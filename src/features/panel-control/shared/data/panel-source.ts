import type { DataOrigin, PanelDataMode } from "../models/data-origin.model";
import type { PanelCatalogo } from "../models/panel-catalog.model";
import type { PanelContractId } from "../models/panel-contract.model";
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
  fetch: (query: ContractQuery<K>, context: PanelSourceContext) => Promise<ContractResult<K>>;
}

export type PanelSourceRegistry = { [K in PanelContractId]?: PanelSource<K> };

export interface ResolvedPanelSource<K extends PanelContractId> {
  source: PanelSource<K> | null;
  origin: DataOrigin;
}

export function resolvePanelSource<K extends PanelContractId>(
  registry: PanelSourceRegistry,
  contractId: K,
  mode: PanelDataMode,
): ResolvedPanelSource<K> {
  const descriptor = PANEL_CONTRACTS[contractId];
  const source = registry[contractId] as PanelSource<K> | undefined;

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
