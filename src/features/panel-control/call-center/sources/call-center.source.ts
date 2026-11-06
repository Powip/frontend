import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { CallCenterPanel } from "../models/call-center.model";

export const callCenterRealSource: PanelSource<"callcenter"> = {
  contractId: "callcenter",
  kind: "real",
  descripcion:
    "GET /panel/callcenter (ms-ventas): leads, cola de ahora, confirmación, motivos, calidad, mapa de calor, ranking y «Mi día». A la Confirmadora el servidor le impone su identidad",
  fetch: (query) => getPanel<PanelEnvelope<CallCenterPanel>>("callcenter", query),
};
