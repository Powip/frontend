import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { ColaPanel } from "../models/cola.model";
import type { CouriersPanel } from "../models/couriers.model";
import type { InventarioPanel } from "../models/inventario.model";

/** Cada sub es una petición propia: si una falla (el inventario depende de otro servicio) las demás siguen. */
export const operacionesColaRealSource: PanelSource<"operaciones-cola"> = {
  contractId: "operaciones-cola",
  kind: "real",
  descripcion:
    "GET /panel/operaciones?sub=cola (ms-ventas): cola por estado y antigüedad, tiempos por etapa, despachos por día y motivos de rechazo. Solo Dueño",
  fetch: (query) => getPanel<PanelEnvelope<ColaPanel>>("operaciones", { ...query, sub: "cola" }),
};

export const operacionesCouriersRealSource: PanelSource<"operaciones-couriers"> = {
  contractId: "operaciones-couriers",
  kind: "real",
  descripcion:
    "GET /panel/operaciones?sub=couriers (ms-ventas): rendimiento por courier y departamento, fletes y lo que falta liquidar. Solo Dueño",
  fetch: (query) =>
    getPanel<PanelEnvelope<CouriersPanel>>("operaciones", { ...query, sub: "couriers" }),
};

export const operacionesInventarioRealSource: PanelSource<"operaciones-inventario"> = {
  contractId: "operaciones-inventario",
  kind: "real",
  descripcion:
    "GET /panel/operaciones?sub=inventario (ms-ventas + stock de ms-logistics): stock, reservado, cobertura y valor al costo. Responde 503 si el inventario no está disponible. Solo Dueño",
  fetch: (query) =>
    getPanel<PanelEnvelope<InventarioPanel>>("operaciones", { ...query, sub: "inventario" }),
};
