import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { ConfigCuadres } from "../models/configuracion.model";

export const configCuadresRealSource: PanelSource<"config-cuadres"> = {
  contractId: "config-cuadres",
  kind: "real",
  descripcion:
    "GET /panel/config/cuadres (ms-ventas): los 9 cuadres con los mismos filtros y la calidad de datos. Solo Dueño",
  fetch: (query) => getPanel<PanelEnvelope<ConfigCuadres>>("config/cuadres", query),
};
