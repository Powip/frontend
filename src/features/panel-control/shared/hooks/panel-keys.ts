import type { DataOriginKind } from "../models/data-origin.model";
import type { PanelContractId } from "../models/panel-contract.model";

export const panelKeys = {
  all: ["panel-control"] as const,
  contract: (contractId: PanelContractId, origin: DataOriginKind, role: string, query: unknown) =>
    [...panelKeys.all, contractId, origin, role, query] as const,
};
