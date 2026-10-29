import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { DetalleResponse } from "../models/detalle.model";

export const detalleRealSource: PanelSource<"detalle"> = {
  contractId: "detalle",
  kind: "real",
  pestanas: ["resumen"],
  descripcion:
    "GET /panel/detalle (ms-ventas): pedidos detrás de cada cifra del Resumen, con búsqueda y paginación en el servidor. Los grupos de otras pestañas responden 400 hasta conectarlos",
  fetch: (query) => getPanel<DetalleResponse>("detalle", query),
};
