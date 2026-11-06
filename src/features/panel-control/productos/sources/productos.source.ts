import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { ProductosPanel } from "../models/productos.model";

export const productosRealSource: PanelSource<"productos"> = {
  contractId: "productos",
  kind: "real",
  descripcion:
    "GET /panel/productos (ms-ventas): KPIs, productos por variante, cupones y categorías. Pendientes: stock (vive en otro servicio), costo unitario y margen cuando falta el costo de alguna línea, y cupones de canales que no son Shopify",
  fetch: (query) => getPanel<PanelEnvelope<ProductosPanel>>("productos", query),
};
