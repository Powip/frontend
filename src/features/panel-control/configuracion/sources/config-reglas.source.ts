import type { PanelSource } from "../../shared/data/panel-source";
import { getConfigComisiones, getConfigCouriers, getConfigGastosFijos } from "../api/config.api";

export const configComisionesRealSource: PanelSource<"config-comisiones"> = {
  contractId: "config-comisiones",
  kind: "real",
  descripcion:
    "GET /config/comisiones (ms-ventas): reglas de comisión por rol y concepto. Solo Dueño",
  fetch: () => getConfigComisiones(),
};

export const configGastosFijosRealSource: PanelSource<"config-gastos-fijos"> = {
  contractId: "config-gastos-fijos",
  kind: "real",
  descripcion: "GET /config/gastos-fijos (ms-ventas): gasto fijo mensual por tienda. Solo Dueño",
  fetch: () => getConfigGastosFijos(),
};

export const configCouriersRealSource: PanelSource<"config-couriers"> = {
  contractId: "config-couriers",
  kind: "real",
  descripcion:
    "GET /config/couriers (ms-ventas): plazo de liquidación y tiempo normal de entrega por courier. Solo Dueño",
  fetch: () => getConfigCouriers(),
};
