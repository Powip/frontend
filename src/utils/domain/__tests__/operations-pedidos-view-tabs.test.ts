import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import {
  DEFAULT_OPERATIONS_TAB,
  OPERATIONS_TABS,
  getOperationsTab,
  getOperationsTabDef,
  resolveOperationsTab,
} from "../operations-pedidos-tabs";

const order = (status: OrderStatus, overrides: Partial<OrderHeader> = {}) => ({ id: "order-1", status, ...overrides }) as OrderHeader;

describe("pestañas de /operaciones/pedidos", () => {
  it("van en el orden pedido: los atajos antes del combinado y Necesita atención al final", () => {
    expect(OPERATIONS_TABS.map((tab) => tab.label)).toEqual([
      "Preparados", "En camino", "Despachados", "Entregados", "Anulados", "Historial", "Necesita atención",
    ]);
  });

  it("ya no existe la pestaña Pendientes ni 'Por Despachar'", () => {
    const labels = OPERATIONS_TABS.map((tab) => tab.label.toLowerCase());
    expect(labels).not.toContain("pendientes");
    expect(labels).not.toContain("por despachar");
    expect(DEFAULT_OPERATIONS_TAB).toBe("preparados");
  });

  it("solo Entregados, Anulados e Historial llevan ventana, y solo Necesita atención es de alerta", () => {
    expect(OPERATIONS_TABS.filter((tab) => tab.windowed).map((tab) => tab.key)).toEqual(["entregados", "anulados", "historial"]);
    expect(OPERATIONS_TABS.filter((tab) => tab.alerta).map((tab) => tab.key)).toEqual(["atencion"]);
  });

  it("Preparados explica que al asignar la guía el pedido cambia a En camino", () => {
    expect(getOperationsTabDef("preparados").description).toBe(
      "Pedidos listos para asignar a una guía de salida. Al asignar la guía, el pedido cambiará a En camino.",
    );
  });

  it("cada pestaña apunta a su pestaña y a su contador en el servidor", () => {
    expect(OPERATIONS_TABS.map((tab) => [tab.key, tab.serverTab, tab.countKey])).toEqual([
      ["preparados", "preparados", "preparados"],
      ["camino", "en-camino", "enCamino"],
      ["despachados", "despachados", "despachados"],
      ["entregados", "entregados", "entregados"],
      ["anulados", "anulados", "anulados"],
      ["historial", "historial", "historial"],
      ["atencion", "atencion", "atencion"],
    ]);
  });
});

describe("resolveOperationsTab — compatibilidad de URLs", () => {
  it.each(["por-despachar", "despachar", "pendientes"])("redirige ?tab=%s a la pestaña por defecto (Preparados)", (slug) => {
    expect(resolveOperationsTab(slug)).toEqual({ tab: "preparados" });
  });

  it("sin tab o con uno desconocido cae en Preparados", () => {
    expect(resolveOperationsTab(null)).toEqual({ tab: "preparados" });
    expect(resolveOperationsTab(undefined)).toEqual({ tab: "preparados" });
    expect(resolveOperationsTab("otra-cosa")).toEqual({ tab: "preparados" });
  });

  it("conserva los slugs vigentes", () => {
    for (const tab of OPERATIONS_TABS) expect(resolveOperationsTab(tab.key).tab).toBe(tab.key);
  });

  it("el antiguo En Camino con filtros de tracking era DESPACHADO: pasa a Despachados con ese filtro", () => {
    expect(resolveOperationsTab("camino", "agencia-por-vencer")).toEqual({ tab: "despachados", quick: "agencia-por-vencer" });
    expect(resolveOperationsTab("camino", "por-confirmar")).toEqual({ tab: "despachados", quick: "por-confirmar" });
    expect(resolveOperationsTab("camino", "listos-escanear")).toEqual({ tab: "camino" });
  });

  it("Despachados acepta directamente el filtro de tracking", () => {
    expect(resolveOperationsTab("despachados", "por-confirmar")).toEqual({ tab: "despachados", quick: "por-confirmar" });
  });
});

describe("getOperationsTab — espejo de la política del servidor", () => {
  it.each([
    ["PREPARADO", "preparados"],
    ["LLAMADO", "preparados"],
    ["ASIGNADO_A_GUIA", "camino"],
    ["EN_ENVIO", "camino"],
    ["DESPACHADO", "despachados"],
    ["ENTREGADO", "entregados"],
    ["ANULADO", "anulados"],
  ] as const)("%s va a %s", (status, tab) => {
    expect(getOperationsTab(order(status))).toBe(tab);
  });

  it.each(["PENDIENTE", "PAGADO", "INCOMPLETE", "PREVENTA"] as OrderStatus[])("%s no se muestra en Operaciones", (status) => {
    expect(getOperationsTab(order(status))).toBeNull();
  });

  it("los leads comerciales y las ventas con stock diferido no se muestran, salvo ya cerradas", () => {
    expect(getOperationsTab(order("PREPARADO", { commercialStage: "LEAD" }))).toBeNull();
    expect(getOperationsTab(order("PREPARADO", { commercialStage: "SALE", commercialStockState: "DEFERRED" }))).toBeNull();
    expect(getOperationsTab(order("ENTREGADO", { commercialStage: "SALE", commercialStockState: "DEFERRED" }))).toBe("entregados");
  });

  it("EN_ENVIO y DESPACHADO con devolución o error del courier van a Necesita atención", () => {
    expect(getOperationsTab(order("EN_ENVIO", { shalomStatus: "DEVUELTO" }))).toBe("atencion");
    expect(getOperationsTab(order("DESPACHADO", { shalomError: "agencia no responde" }))).toBe("atencion");
    expect(getOperationsTab(order("DESPACHADO", { syncErrors: { shalom: "timeout" } }))).toBe("atencion");
  });

  it("un error vacío no cuenta, y el ASIGNADO_A_GUIA nunca va a atención", () => {
    expect(getOperationsTab(order("DESPACHADO", { shalomError: "", syncErrors: {} }))).toBe("despachados");
    expect(getOperationsTab(order("ASIGNADO_A_GUIA", { shalomStatus: "DEVUELTO" }))).toBe("camino");
  });
});
