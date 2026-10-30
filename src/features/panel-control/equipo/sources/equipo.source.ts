import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { EquipoConfirmadorasPanel, EquipoVendedorasPanel } from "../models/equipo.model";

export const equipoVendedorasRealSource: PanelSource<"equipo-vendedoras"> = {
  contractId: "equipo-vendedoras",
  kind: "real",
  descripcion:
    "GET /panel/equipo?tipo=vendedoras (ms-ventas): ventas directas y POS por asesora o zona, cobranza, upsell y ticket entregado. Sin metas ni comisiones configuradas",
  fetch: (query) =>
    getPanel<PanelEnvelope<EquipoVendedorasPanel>>("equipo", { ...query, tipo: "vendedoras" }),
};

export const equipoConfirmadorasRealSource: PanelSource<"equipo-confirmadoras"> = {
  contractId: "equipo-confirmadoras",
  kind: "real",
  descripcion:
    "GET /panel/equipo?tipo=confirmadoras (ms-ventas): el mismo cálculo de leads que el ranking de Call center. Sin metas ni comisiones configuradas",
  fetch: (query) =>
    getPanel<PanelEnvelope<EquipoConfirmadorasPanel>>("equipo", {
      ...query,
      tipo: "confirmadoras",
    }),
};
