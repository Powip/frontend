import type { PanelContractId } from "./panel-contract.model";

export type DataOriginKind = "real" | "demo" | "pendiente";

export interface DataOrigin {
  kind: DataOriginKind;
  contractId: PanelContractId;
  endpoint: string;
  detalle: string;
}

export const PANEL_DATA_MODES = ["mixto", "solo_real"] as const;

export type PanelDataMode = (typeof PANEL_DATA_MODES)[number];
