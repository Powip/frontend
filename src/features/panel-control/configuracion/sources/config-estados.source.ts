import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { ConfigEstados } from "../models/configuracion.model";

export const configEstadosRealSource: PanelSource<"config-estados"> = {
  contractId: "config-estados",
  kind: "real",
  descripcion:
    "GET /panel/config/estados (ms-ventas): pedidos del periodo en cada uno de los 9 estados del panel. Solo Dueño",
  fetch: (query) => getPanel<PanelEnvelope<ConfigEstados>>("config/estados", query),
};
