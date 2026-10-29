import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { CanalesComparativo } from "../models/canales-comparativo.model";

export const canalesComparativoRealSource: PanelSource<"canales-comparativo"> = {
  contractId: "canales-comparativo",
  kind: "real",
  descripcion:
    "GET /panel/canales?vista= (ms-ventas): comparativo de ventas y entregas por canal de origen, fichas y tendencia semanal. Pendientes: metas, primer intento, flete, familia y la ganancia (costo, pauta y comisión)",
  fetch: (query) => getPanel<PanelEnvelope<CanalesComparativo>>("canales", query),
};
