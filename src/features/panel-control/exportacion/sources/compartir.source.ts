import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { CompartirReporteResponse } from "../models/exportacion.model";

export const compartirReporteRealSource: PanelSource<"compartir-reporte"> = {
  contractId: "compartir-reporte",
  kind: "real",
  descripcion:
    "GET /panel/compartir (ms-ventas, solo Dueño): cifras y texto listo para WhatsApp, con una sola ganancia (sobre lo entregado)",
  fetch: (query) => getPanel<CompartirReporteResponse>("compartir", query),
};
