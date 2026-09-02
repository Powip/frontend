import type { OrderStatus } from "@/interfaces/IOrder";
import {
  ORDER_STATUS_FLOW,
  getAvailableStatuses,
  getStatusChainSteps,
  toFulfillmentStatus,
} from "../orders-status-flow";

/**
 * Tests de las funciones puras del flujo de estados de pedidos.
 *
 * Contexto (bug corregido): un pedido en `PAGADO` ("PENDIENTE + cobrado al
 * 100%") no se podía asignar a guía desde /operaciones/pedidos. La corrección
 * vive en dos piezas puras:
 *
 *  - `getStatusChainSteps` normaliza `PAGADO`→`PENDIENTE` para poder encadenar
 *    los PATCH intermedios (PREPARADO→LLAMADO→…) que el backend exige de a un
 *    paso, sin exponerle la mecánica al usuario.
 *  - `ORDER_STATUS_FLOW.PAGADO` queda espejado al backend: solo el salto
 *    directo `PAGADO`→`PREPARADO` (+`ANULADO`). Este archivo lo fija como
 *    guardia anti-regresión.
 */

describe("getStatusChainSteps", () => {
  describe("desde PAGADO (se normaliza a PENDIENTE para calcular la cadena)", () => {
    it("PAGADO → LLAMADO encadena PREPARADO y LLAMADO", () => {
      expect(getStatusChainSteps("PAGADO", "LLAMADO")).toEqual([
        "PREPARADO",
        "LLAMADO",
      ]);
    });

    it("PAGADO → EN_ENVIO encadena PREPARADO, LLAMADO y EN_ENVIO", () => {
      expect(getStatusChainSteps("PAGADO", "EN_ENVIO")).toEqual([
        "PREPARADO",
        "LLAMADO",
        "EN_ENVIO",
      ]);
    });

    it("PAGADO → ASIGNADO_A_GUIA devuelve un único paso directo (ASIGNADO_A_GUIA no está en la progresión lineal)", () => {
      expect(getStatusChainSteps("PAGADO", "ASIGNADO_A_GUIA")).toEqual([
        "ASIGNADO_A_GUIA",
      ]);
    });
  });

  describe("sin regresión: mismo comportamiento para PREPARADO / PENDIENTE", () => {
    it("PREPARADO → LLAMADO es un solo paso", () => {
      expect(getStatusChainSteps("PREPARADO", "LLAMADO")).toEqual(["LLAMADO"]);
    });

    it("PENDIENTE → EN_ENVIO encadena PREPARADO, LLAMADO y EN_ENVIO", () => {
      expect(getStatusChainSteps("PENDIENTE", "EN_ENVIO")).toEqual([
        "PREPARADO",
        "LLAMADO",
        "EN_ENVIO",
      ]);
    });

    it("PREPARADO → ENTREGADO encadena LLAMADO, EN_ENVIO y ENTREGADO", () => {
      expect(getStatusChainSteps("PREPARADO", "ENTREGADO")).toEqual([
        "LLAMADO",
        "EN_ENVIO",
        "ENTREGADO",
      ]);
    });
  });

  describe("guardas: no se retrocede ni se repite estado", () => {
    it("LLAMADO → LLAMADO devuelve [] (target ya alcanzado)", () => {
      expect(getStatusChainSteps("LLAMADO", "LLAMADO")).toEqual([]);
    });

    it("ASIGNADO_A_GUIA → LLAMADO devuelve [] (target quedó atrás en el flujo — no hay PATCH hacia atrás)", () => {
      expect(getStatusChainSteps("ASIGNADO_A_GUIA", "LLAMADO")).toEqual([]);
    });
  });

  it("LLAMADO → ANULADO devuelve ['ANULADO'] (ANULADO no tiene rank, la guarda de retroceso no aplica)", () => {
    expect(getStatusChainSteps("LLAMADO", "ANULADO")).toEqual(["ANULADO"]);
  });
});

describe("toFulfillmentStatus", () => {
  it("mapea PAGADO a PENDIENTE (el cobro no es una etapa de fulfillment)", () => {
    expect(toFulfillmentStatus("PAGADO")).toBe("PENDIENTE");
  });

  it.each<OrderStatus>([
    "PENDIENTE",
    "PREPARADO",
    "LLAMADO",
    "ASIGNADO_A_GUIA",
    "EN_ENVIO",
    "ENTREGADO",
    "ANULADO",
    "PREVENTA",
    "INCOMPLETE",
  ])("deja %s sin cambios", (status) => {
    expect(toFulfillmentStatus(status)).toBe(status);
  });
});

describe("ORDER_STATUS_FLOW.PAGADO (guardia anti-regresión — fiel al backend)", () => {
  it("solo permite el salto directo a PREPARADO o ANULADO", () => {
    expect(ORDER_STATUS_FLOW.PAGADO).toEqual(["PREPARADO", "ANULADO"]);
  });
});

describe("getAvailableStatuses", () => {
  it("para PAGADO ofrece el estado actual + PREPARADO + ANULADO", () => {
    expect(getAvailableStatuses("PAGADO")).toEqual([
      "PAGADO",
      "PREPARADO",
      "ANULADO",
    ]);
  });

  it("nunca incluye INCOMPLETE aunque sea el estado actual", () => {
    expect(getAvailableStatuses("INCOMPLETE")).toEqual([
      "PREVENTA",
      "PENDIENTE",
      "ANULADO",
    ]);
  });

  it("para un estado terminal (ANULADO) devuelve solo el estado actual", () => {
    expect(getAvailableStatuses("ANULADO")).toEqual(["ANULADO"]);
  });
});
