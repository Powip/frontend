import type { PanelSource } from "../../shared/data/panel-source";
import { getConfigMetas } from "../api/config.api";

export const configMetasRealSource: PanelSource<"config-metas"> = {
  contractId: "config-metas",
  kind: "real",
  descripcion:
    "GET /config/metas (ms-ventas): metas por indicador (porcentajes como fracción 0..1) y metas mensuales por canal, vendedora y confirmadora. Solo Dueño",
  fetch: () => getConfigMetas(),
};
