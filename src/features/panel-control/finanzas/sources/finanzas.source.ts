import { getPanel } from "../../shared/api/panel-http";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { CajaPanel } from "../models/caja.model";
import type { CobranzaPanel } from "../models/cobranza.model";
import type { ResultadoPanel } from "../models/resultado.model";

/** Cada reloj es una petición propia (`?reloj=`): ganancia por pedido, dinero por fecha de cobro y deuda actual. Solo Dueño. */
export const finanzasResultadoRealSource: PanelSource<"finanzas-resultado"> = {
  contractId: "finanzas-resultado",
  kind: "real",
  descripcion:
    "GET /panel/finanzas?reloj=pedido (ms-ventas): del facturado al dinero, estado de resultados antes de publicidad, punto de equilibrio, evolución y rentabilidad por canal. Solo Dueño",
  fetch: (query) =>
    getPanel<PanelEnvelope<ResultadoPanel>>("finanzas", { ...query, reloj: "pedido" }),
};

export const finanzasCajaRealSource: PanelSource<"finanzas-caja"> = {
  contractId: "finanzas-caja",
  kind: "real",
  descripcion:
    "GET /panel/finanzas?reloj=caja (ms-ventas): entradas y salidas por la fecha de registro del pago (no hay liquidaciones de courier). Solo Dueño",
  fetch: (query) => getPanel<PanelEnvelope<CajaPanel>>("finanzas", { ...query, reloj: "caja" }),
};

export const finanzasCobranzaRealSource: PanelSource<"finanzas-cobranza"> = {
  contractId: "finanzas-cobranza",
  kind: "real",
  descripcion:
    "GET /panel/finanzas?reloj=cobranza (ms-ventas): entregados con courier sin pago completo (365 días, hasta 5000 pedidos), vencido y antigüedad. Estado actual. Solo Dueño",
  fetch: (query) =>
    getPanel<PanelEnvelope<CobranzaPanel>>("finanzas", { ...query, reloj: "cobranza" }),
};
