import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { CanalDetalle } from "../models/canal-detalle.model";

export const canalesDetalleRealSource: PanelSource<"canales-detalle"> = {
  contractId: "canales-detalle",
  kind: "real",
  descripcion:
    "GET /panel/canales/{id} (ms-ventas): ficha, KPIs y bloque propio del canal (lead, conversacional, presencial, marketplace o prepago, inferido de sus pedidos). Pendientes: costos, sesiones Live, comisión y plazo de liquidación",
  fetch: ({ canal_id: canalId, ...filtros }) =>
    getPanel<PanelEnvelope<CanalDetalle>>(`canales/${encodeURIComponent(canalId)}`, filtros),
};
