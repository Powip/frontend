import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { MisVentasPanel } from "../models/mis-ventas.model";

export const misVentasRealSource: PanelSource<"mis-ventas"> = {
  contractId: "mis-ventas",
  kind: "real",
  descripcion:
    "GET /panel/mis-ventas (ms-ventas): ventas directas y POS de la vendedora autenticada; el ranking va anónimo. Sin meta ni comisión",
  fetch: (query) => getPanel<PanelEnvelope<MisVentasPanel>>("mis-ventas", query),
};
