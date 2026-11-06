import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { EstadoPeriodo } from "../models/estado-periodo.model";

export const estadoPeriodoRealSource: PanelSource<"estado-periodo"> = {
  contractId: "estado-periodo",
  kind: "real",
  descripcion:
    "GET /panel/estado (ms-ventas): pedidos del periodo y % aún abierto. Aún sin el bloque «calidad» de cuadres",
  fetch: (query) => getPanel<PanelEnvelope<EstadoPeriodo>>("estado", query),
};
