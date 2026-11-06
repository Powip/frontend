import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { ClientesZonasPanel } from "../models/clientes-zonas.model";

export const clientesZonasRealSource: PanelSource<"clientes-zonas"> = {
  contractId: "clientes-zonas",
  kind: "real",
  descripcion:
    "GET /panel/clientes (ms-ventas): clientes nuevos y recurrentes, recompra, lista negra, zonas, departamentos, métodos de pago y mejores clientes. El historial cubre desde el primer pedido de la empresa",
  fetch: (query) => getPanel<PanelEnvelope<ClientesZonasPanel>>("clientes", query),
};
