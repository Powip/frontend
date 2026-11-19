/**
 * Tests: reglas puras de los lotes (FEAT-24 H5-L).
 *
 * 1. Estado que se ve (vigente, por vencer, vencido, bloqueado) y textos de días.
 * 2. Validación del lote nuevo.
 * 3. Lotes del kardex y de las líneas de traslado.
 * 4. Errores: 409 LOTE_VENCIDO (con code o solo el mensaje de ms-ventas) y LOTE_VENCIMIENTO_DISTINTO.
 */

import {
  expiredLotDispatchMessage,
  expiryText,
  isExpiredLotError,
  isLotReceiveConflict,
  kardexLotsOf,
  kardexLotsText,
  lotDate,
  lotKey,
  lotStatusView,
  lotWriteErrorMessage,
  newLotProblem,
  transferLineLotText,
  variantNames,
} from "../lots";

const conflict = (data: Record<string, unknown>) => ({ response: { status: 409, data } });

describe("estado y días", () => {
  it("vencido, bloqueado, por vencer (dentro del aviso) y vigente", () => {
    expect(lotStatusView({ status: "vencido", daysToExpiry: -3 })).toEqual({ label: "Vencido", tone: "red" });
    expect(lotStatusView({ status: "bloqueado", daysToExpiry: 5 })).toEqual({ label: "Bloqueado", tone: "slate" });
    expect(lotStatusView({ status: "vigente", daysToExpiry: 7 })).toEqual({ label: "Por vencer · 7 días", tone: "amber" });
    expect(lotStatusView({ status: "vigente", daysToExpiry: 0 })).toEqual({ label: "Vence hoy", tone: "amber" });
    expect(lotStatusView({ status: "vigente", daysToExpiry: 45 })).toEqual({ label: "Vigente", tone: "green" });
    expect(lotStatusView({ status: "vigente", daysToExpiry: 45 }, 60)).toEqual({ label: "Por vencer · 45 días", tone: "amber" });
    expect(lotStatusView({ status: "vigente", daysToExpiry: null })).toEqual({ label: "Vigente", tone: "green" });
  });

  it("textos de días y fechas", () => {
    expect(expiryText(-1)).toBe("vencido hace 1 día");
    expect(expiryText(-18)).toBe("vencido hace 18 días");
    expect(expiryText(0)).toBe("vence hoy");
    expect(expiryText(1)).toBe("en 1 día");
    expect(expiryText(null)).toBe("");
    expect(lotDate("2027-08-30")).toBe("30/08/2027");
    expect(lotDate(null)).toBe("Sin fecha");
  });
});

describe("lote nuevo", () => {
  it("pide número y fecha válida, con los topes del servidor", () => {
    expect(newLotProblem({ lotNumber: " ", expiresAt: "2027-01-31" })).toBe("Escribe el número de lote.");
    expect(newLotProblem({ lotNumber: "L1", expiresAt: "" })).toBe("Elige la fecha de vencimiento.");
    expect(newLotProblem({ lotNumber: "L1", expiresAt: "2027-02-30" })).not.toBeNull();
    expect(newLotProblem({ lotNumber: "x".repeat(41), expiresAt: "2027-01-31" })).not.toBeNull();
    expect(newLotProblem({ lotNumber: "L1", expiresAt: "2027-01-31", comment: "y".repeat(301) })).not.toBeNull();
    expect(newLotProblem({ lotNumber: "L1", expiresAt: "2027-01-31", comment: "ok" })).toBeNull();
    expect(lotKey(" l2408 ")).toBe("L2408");
  });
});

describe("kardex y traslados", () => {
  it("lee `lots` (o `lotAllocations`) y lo escribe con signo", () => {
    const lots = [{ lotId: "l1", lotNumber: "A117", quantity: -3 }, { lotId: null, lotNumber: null, quantity: -1 }];
    expect(kardexLotsOf({ lots })).toBe(lots);
    expect(kardexLotsOf({ lotAllocations: lots })).toBe(lots);
    expect(kardexLotsOf({ lots: [] })).toBeNull();
    expect(kardexLotsOf({})).toBeNull();
    expect(kardexLotsText(lots)).toBe("A117 −3 · Sin lote −1");
    expect(kardexLotsText([{ lotId: "l2", lotNumber: "L2410", quantity: 20 }])).toBe("L2410 +20");
  });

  it("línea de traslado: en qué lotes salió o el lote elegido", () => {
    expect(transferLineLotText({ lots: [{ lotId: "l1", lotNumber: "L2408", quantity: -3 }, { lotId: null, lotNumber: null, quantity: -1 }] })).toBe("Lotes: L2408 ×3 · Sin lote ×1");
    expect(transferLineLotText({ lotNumber: "G1", lotExpiresAt: "2027-01-31", lots: null })).toBe("Lote G1 · vence 31/01/2027");
    expect(transferLineLotText({})).toBeNull();
  });

  it("nombre de la variante con sus atributos y el SKU de la empresa", () => {
    const names = variantNames([{ id: "v1", sku: "INT-1", companySku: "CRE-50", barcode: null, powipEan: null, attributeValues: { Tamaño: "50 ml" }, productName: "Crema" }]);
    expect(names.get("v1")).toEqual({ name: "Crema · Tamaño: 50 ml", sku: "CRE-50" });
  });
});

describe("errores de lotes", () => {
  it("LOTE_VENCIDO con los datos de logística: unidades y lotes", () => {
    const error = conflict({
      code: "LOTE_VENCIDO",
      message: "Solo hay 2 unidades vigentes para despachar 5: el resto está en lotes vencidos o bloqueados. Registra la merma del lote vencido, desbloquéalo o recibe stock nuevo.",
      required: 5,
      usable: 2,
      lots: [
        { number: "L2408", status: "vigente", expiresAt: "2027-08-30", quantity: 2 },
        { number: "A117", status: "vencido", expiresAt: "2026-10-31", quantity: 3 },
        { number: "B500", status: "bloqueado", expiresAt: "2027-02-01", quantity: 1 },
      ],
    });
    expect(isExpiredLotError(error)).toBe(true);
    expect(expiredLotDispatchMessage(error, "Crema Centella")).toBe(
      "Solo quedan lotes vencidos o bloqueados de Crema Centella: no se puede despachar. Hay 2 unidades vigentes para despachar 5. Lotes: A117 (vencido el 31/10/2026, 3 und), B500 (bloqueado, 1 und). Registra la merma del lote vencido, desbloquéalo en la ficha del producto (pestaña Lotes) o recibe stock nuevo.",
    );
  });

  it("desde ms-ventas llega solo el mensaje: se reconoce por el texto", () => {
    const error = conflict({ message: "Solo hay 0 unidades vigentes para despachar 1: el resto está en lotes vencidos o bloqueados. Registra la merma del lote vencido, desbloquéalo o recibe stock nuevo." });
    expect(expiredLotDispatchMessage(error)).toBe(
      "Solo quedan lotes vencidos o bloqueados: no se puede despachar. Solo hay 0 unidades vigentes para despachar 1: el resto está en lotes vencidos o bloqueados. Registra la merma del lote vencido, desbloquéalo en la ficha del producto (pestaña Lotes) o recibe stock nuevo.",
    );
    expect(expiredLotDispatchMessage(conflict({ message: "Faltan productos por tomar." }))).toBeNull();
    expect(expiredLotDispatchMessage({ response: { status: 400, data: { message: "lotes vencidos o bloqueados" } } })).toBeNull();
  });

  it("LOTE_VENCIMIENTO_DISTINTO al recibir: con code o por el texto (cola del celular)", () => {
    const message = "El lote L2410 de CRE-50 ya existe con vencimiento 30/09/2027; revisa la fecha (llegó 31/10/2027) o usa otro número.";
    expect(isLotReceiveConflict(conflict({ code: "LOTE_VENCIMIENTO_DISTINTO", message }))).toBe(true);
    expect(isLotReceiveConflict(conflict({ message }))).toBe(true);
    expect(isLotReceiveConflict(conflict({ message: "POLO: quedan 2 pendientes." }))).toBe(false);
    expect(lotWriteErrorMessage(conflict({ code: "LOTE_VENCIMIENTO_DISTINTO", message }), "x")).toBe(message);
    expect(lotWriteErrorMessage(conflict({ code: "LOTE_SIN_SALDO" }), "x")).toBe("El lote elegido no tiene tantas unidades en este almacén.");
    expect(lotWriteErrorMessage(new Error("red"), "No se pudo.")).toBe("No se pudo.");
  });
});
