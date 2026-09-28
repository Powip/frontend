import type { PanelContractId } from "../models/panel-contract.model";
import type { PanelCapability, PanelRole } from "../models/panel-role.model";
import { PANEL_CONTRACTS } from "./panel-contracts";
import { PanelAccesoDenegadoError } from "./panel-identidad";
import type { PanelSource, PanelSourceContext } from "./panel-source";

export function rolPuedeUsarContrato(
  contractId: PanelContractId,
  role: PanelRole,
  capacidades: ReadonlySet<PanelCapability>,
): boolean {
  const descriptor = PANEL_CONTRACTS[contractId];
  if (!descriptor.roles.includes(role)) return false;
  return !descriptor.capacidadRequerida || capacidades.has(descriptor.capacidadRequerida);
}

export function autorizarContrato(contractId: PanelContractId, context: PanelSourceContext): void {
  if (!rolPuedeUsarContrato(contractId, context.role, context.capabilities)) {
    const descriptor = PANEL_CONTRACTS[contractId];
    throw new PanelAccesoDenegadoError(
      `el rol ${context.role} no puede usar ${descriptor.metodo} ${descriptor.endpoint}`,
    );
  }
}

export function conAutorizacion<K extends PanelContractId>(source: PanelSource<K>): PanelSource<K> {
  return {
    ...source,
    fetch: async (query, context) => {
      autorizarContrato(source.contractId, context);
      return source.fetch(query, context);
    },
  };
}
