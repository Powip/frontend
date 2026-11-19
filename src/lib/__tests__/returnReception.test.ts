import {
  applyScan,
  buildReceiveBody,
  draftFromReception,
  draftIsValid,
  fillRemainingAsReingreso,
  lineProblem,
  parseCount,
  receptionsInScope,
  receptionVariantIds,
  resolveScan,
  scanErrorMessage,
  summarizeReceived,
  updateLine,
  type ReceptionLineDraft,
} from "../returnReception";
import type { ReturnReception } from "@/services/warehousesService";
import type { VariantCodeMatch } from "@/services/variantCodesService";

const V1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const V2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORIGIN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const reception = (over: Partial<ReturnReception> = {}): ReturnReception => ({
  id: "r-1",
  companyId: "c-1",
  orderId: "o-1",
  orderNumber: "ORD-1",
  inventoryId: ORIGIN,
  status: "por_recibir",
  lines: [
    { variantId: V1, quantity: 3 },
    { variantId: V2, quantity: 1 },
  ],
  createdAt: "2026-11-17T15:00:00.000Z",
  receivedAt: null,
  receivedBy: null,
  receivedByName: null,
  receivedInventoryId: null,
  receivedLines: null,
  ...over,
});

const line = (over: Partial<ReceptionLineDraft> = {}): ReceptionLineDraft => ({
  variantId: V1,
  quantity: 3,
  reingreso: 0,
  merma: 0,
  reason: "",
  ...over,
});

const match = (variantId: string, code = "X"): VariantCodeMatch => ({
  code,
  variantId,
  sku: "SKU",
  companySku: null,
  productId: "p",
  productName: "Producto",
});

describe("recibir una devolución (FEAT-24 H2-F)", () => {
  it("arma un borrador por producto, en 0, sumando líneas repetidas", () => {
    expect(draftFromReception(reception({ lines: [{ variantId: V1, quantity: 2 }, { variantId: V1.toUpperCase(), quantity: 1 }] }))).toEqual([
      { variantId: V1, quantity: 3, reingreso: 0, merma: 0, reason: "" },
    ]);
    expect(draftFromReception(reception())).toHaveLength(2);
  });

  it("reingreso + merma tiene que dar exactamente lo que volvió", () => {
    expect(lineProblem(line())).toBe("Faltan 3 por asignar: reingreso + merma tiene que dar 3.");
    expect(lineProblem(line({ reingreso: 2 }))).toBe("Falta 1 por asignar: reingreso + merma tiene que dar 3.");
    expect(lineProblem(line({ reingreso: 3, merma: 1, reason: "roto" }))).toBe("Sobra 1: volvieron 3.");
    expect(lineProblem(line({ reingreso: 5 }))).toBe("Sobran 2: volvieron 3.");
    expect(lineProblem(line({ reingreso: 3 }))).toBeNull();
  });

  it("la merma necesita motivo (hasta 200 caracteres)", () => {
    expect(lineProblem(line({ reingreso: 2, merma: 1 }))).toBe("Indica el motivo de la merma.");
    expect(lineProblem(line({ reingreso: 2, merma: 1, reason: "   " }))).toBe("Indica el motivo de la merma.");
    expect(lineProblem(line({ reingreso: 2, merma: 1, reason: "x".repeat(201) }))).toMatch(/hasta 200/);
    expect(lineProblem(line({ reingreso: 2, merma: 1, reason: "Envase roto" }))).toBeNull();
  });

  it("rechaza cantidades que no son enteros desde 0", () => {
    expect(lineProblem(line({ reingreso: -1, merma: 4, reason: "x" }))).toMatch(/enteros/);
    expect(lineProblem(line({ reingreso: 1.5, merma: 1.5, reason: "x" }))).toMatch(/enteros/);
  });

  it("solo es válida si todas las líneas cuadran", () => {
    expect(draftIsValid([])).toBe(false);
    expect(draftIsValid([line({ reingreso: 3 }), line({ variantId: V2, quantity: 1 })])).toBe(false);
    expect(draftIsValid([line({ reingreso: 3 }), line({ variantId: V2, quantity: 1, merma: 1, reason: "roto" })])).toBe(true);
  });

  it("lee los campos de cantidad sin negativos", () => {
    expect(parseCount("")).toBe(0);
    expect(parseCount("4")).toBe(4);
    expect(parseCount("-2")).toBe(0);
    expect(parseCount("abc")).toBe(0);
  });

  it("actualiza una línea y completa lo que falta como reingreso", () => {
    const lines = [line({ merma: 1, reason: "roto" }), line({ variantId: V2, quantity: 1 })];
    expect(updateLine(lines, V2, { merma: 1 })[1].merma).toBe(1);
    expect(fillRemainingAsReingreso(lines).map((l) => [l.reingreso, l.merma])).toEqual([[2, 1], [1, 0]]);
  });

  it("arma el cuerpo con una línea de reingreso y/o una de merma por producto", () => {
    const body = buildReceiveBody(
      [line({ reingreso: 2, merma: 1, reason: "  Envase roto " }), line({ variantId: V2, quantity: 1, reingreso: 1 })],
      ORIGIN,
      ORIGIN,
    );
    expect(body).toEqual({
      lines: [
        { variantId: V1, quantity: 2, result: "reingreso" },
        { variantId: V1, quantity: 1, result: "merma", reason: "Envase roto" },
        { variantId: V2, quantity: 1, result: "reingreso" },
      ],
    });
  });

  it("manda el almacén solo si el reingreso va a otro distinto del pedido", () => {
    expect(buildReceiveBody([line({ reingreso: 3 })], OTHER, ORIGIN).inventoryId).toBe(OTHER);
    expect(buildReceiveBody([line({ reingreso: 3 })], ORIGIN, ORIGIN)).not.toHaveProperty("inventoryId");
    // Todo merma: el almacén de reingreso no importa.
    expect(buildReceiveBody([line({ merma: 3, reason: "x" })], OTHER, ORIGIN)).not.toHaveProperty("inventoryId");
  });
});

describe("escaneo en la recepción (FEAT-24 H2-F)", () => {
  const lines = [line(), line({ variantId: V2, quantity: 1 })];

  it("un código de una línea pendiente suma 1 al reingreso", () => {
    const outcome = resolveScan([match(V2.toUpperCase())], lines);
    expect(outcome).toEqual({ kind: "added", variantId: V2 });
    expect(applyScan(lines, V2)[1]).toMatchObject({ reingreso: 1 });
  });

  it("distingue código desconocido, producto ajeno a la devolución y línea completa", () => {
    expect(resolveScan([], lines)).toEqual({ kind: "unknown" });
    expect(resolveScan([match("cccccccc-cccc-4ccc-8ccc-cccccccccccc")], lines)).toEqual({ kind: "not_in_reception" });
    const full = applyScan(lines, V2);
    expect(resolveScan([match(V2)], full)).toEqual({ kind: "line_complete", variantId: V2 });
    // La merma también cuenta como asignado.
    expect(resolveScan([match(V1)], [line({ merma: 3, reason: "x" })])).toEqual({ kind: "line_complete", variantId: V1 });
  });

  it("si el código es de varias variantes, suma a la primera con pendiente", () => {
    const full = [line({ reingreso: 3 }), line({ variantId: V2, quantity: 1 })];
    expect(resolveScan([match(V1), match(V2)], full)).toEqual({ kind: "added", variantId: V2 });
  });

  it("explica cada error", () => {
    expect(scanErrorMessage({ kind: "unknown" }, "779")).toBe("El código 779 no es de ningún producto de tu empresa.");
    expect(scanErrorMessage({ kind: "not_in_reception" }, "779")).toMatch(/no es de ningún producto pendiente de esta devolución/);
    expect(scanErrorMessage({ kind: "line_complete", variantId: V1 }, "779", "Polo M")).toMatch(/^Polo M ya está completo/);
  });
});

describe("recibidas y alcance (FEAT-24 H2-F)", () => {
  it("agrupa lo recibido por producto con los motivos de merma", () => {
    expect(
      summarizeReceived([
        { variantId: V1, quantity: 2, result: "reingreso", reason: null },
        { variantId: V1, quantity: 1, result: "merma", reason: "Roto" },
        { variantId: V2, quantity: 1, result: "merma", reason: null },
      ]),
    ).toEqual([
      { variantId: V1, reingreso: 2, merma: 1, reasons: ["Roto"] },
      { variantId: V2, reingreso: 0, merma: 1, reasons: [] },
    ]);
    expect(summarizeReceived(null)).toEqual([]);
  });

  it("en una tienda muestra solo las devoluciones de sus almacenes", () => {
    const list = [reception({ id: "a" }), reception({ id: "b", inventoryId: OTHER })];
    expect(receptionsInScope(list, null)).toBe(list);
    expect(receptionsInScope(list, [OTHER]).map((r) => r.id)).toEqual(["b"]);
  });

  it("junta los productos a nombrar (devueltos y recibidos)", () => {
    const ids = receptionVariantIds([
      reception({ lines: [{ variantId: V2, quantity: 1 }], receivedLines: [{ variantId: V1, quantity: 1, result: "merma", reason: "x" }] }),
      reception({ lines: [{ variantId: V2, quantity: 2 }] }),
    ]);
    expect(ids).toEqual([V1, V2]);
  });
});
