import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { ResumenPanel } from "../models/resumen.model";

export const resumenRealSource: PanelSource<"resumen"> = {
  contractId: "resumen",
  kind: "real",
  descripcion:
    "GET /panel/resumen (ms-ventas): Vendí, Entregado, Me deben, tareas de hoy, ventas diarias y por canal, clientes y flujo. Pendientes: Gané, inventario, comparación con el periodo anterior",
  fetch: (query) => getPanel<PanelEnvelope<ResumenPanel>>("resumen", query),
};
