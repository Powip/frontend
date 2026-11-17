import {
  addFormLines,
  addOneToLine,
  buildOrderBody,
  buildReceiveLines,
  canReturnOrder,
  emptyOrderForm,
  fillPending,
  formatDay,
  formatMoney,
  formFromOrder,
  isMasked,
  MASK,
  orderFormProblem,
  paymentText,
  previewForm,
  previewOrder,
  purchaseAccess,
  receiveDraft,
  receiveDraftValid,
  receiveLineProblem,
  resolveReceiveScan,
  setReceiveQuantity,
  type OrderFormLine,
} from "../purchaseOrders";
import type { PurchaseOrder, PurchaseOrderLine } from "@/services/purchasesService";

// FEAT-24 H3-E — reglas del front de compras: acceso por rol, vista previa de
// montos (espejo del servidor), formulario de la OC y recepción parcial.

function line(overrides: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine {
  return {
    id: "item-1",
    variantId: "var-1",
    sku: "POLO-M",
    productName: "Polo",
    attributes: { Talla: "M" },
    supplierId: "sup-1",
    supplierName: "Textiles",
    purchaseUnit: "Caja",
    purchaseFactor: 12,
    purchaseQuantity: 2,
    quantity: 24,
    receivedQuantity: 0,
    returnedQuantity: 0,
    pendingQuantity: 24,
    unitPrice: 120,
    unitCostNet: 10,
    entryCost: 11,
    ...overrides,
  };
}

function order(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: "oc-1",
    companyId: "c-1",
    number: "OC-0001",
    origin: "order",
    status: "PEDIDA",
    supplierId: "sup-1",
    supplierName: "Textiles",
    inventoryId: "inv-1",
    storeId: null,
    pricesIncludeIgv: false,
    expenses: 30,
    subtotal: 300,
    igvAmount: 54,
    total: 354,
    document: "F001-123",
    notes: null,
    purchaseDate: "2026-11-17",
    receiptType: "FACTURA",
    paymentMethod: null,
    paymentStatus: "pendiente",
    paidAt: null,
    dueDate: null,
    orderedAt: "2026-11-17T15:00:00Z",
    receivedAt: null,
    hasTrackedUnits: false,
    cancelReason: null,
    cancelledBy: null,
    cancelledAt: null,
    userEmail: "ana@powip.test",
    userName: "ana@powip.test",
    createdAt: "2026-11-17T15:00:00Z",
    updatedAt: "2026-11-17T15:00:00Z",
    lines: [line(), line({ id: "item-2", variantId: "var-2", sku: "GORRA", productName: "Gorra", attributes: null, purchaseUnit: null, purchaseFactor: 1, purchaseQuantity: 10, quantity: 10, pendingQuantity: 10, unitPrice: 6 })],
    ...overrides,
  };
}

describe("acceso por rol (H3-D6)", () => {
  it("Administrador: escribe, paga, anula y ve costos", () => {
    expect(purchaseAccess({ role: "ADMIN" })).toEqual({ canWrite: true, canAdmin: true, canSeeCosts: true });
    expect(purchaseAccess({ role: " administrador " }).canAdmin).toBe(true);
  });

  it("Operaciones: escribe y ve costos, pero no paga ni anula", () => {
    expect(purchaseAccess({ role: "OPERACIONES" })).toEqual({ canWrite: true, canAdmin: false, canSeeCosts: true });
  });

  it("Ventas, CALLER y Almacén: solo leen y sin costos", () => {
    for (const role of ["VENTAS", "CALLER", "ALMACEN"])
      expect(purchaseAccess({ role, permissions: ["MANAGE_INVENTORY"] })).toEqual({
        canWrite: false,
        canAdmin: false,
        canSeeCosts: false,
      });
  });
});

describe("costo enmascarado", () => {
  it("sin la clave muestra ••••; null es «—»; con número, soles", () => {
    expect(formatMoney(undefined)).toBe(MASK);
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(354)).toMatch(/S\/\s*354\.00/);
    expect(formatMoney(10.1234, 4)).toMatch(/10\.1234/);
    const withoutTotal: Partial<PurchaseOrder> = { ...order() };
    delete withoutTotal.total;
    expect(isMasked(withoutTotal, "total")).toBe(true);
    expect(isMasked(order(), "total")).toBe(false);
  });
});

describe("vista previa de los montos (H3-D3/D5)", () => {
  const lines = [
    { purchaseQuantity: 2, purchaseFactor: 12, unitPrice: 120 },
    { purchaseQuantity: 10, purchaseFactor: 1, unitPrice: 6 },
  ];

  it("precios SIN IGV en empresa afecta: suma 18 %; los gastos van al costo por valor y no al total", () => {
    const preview = previewOrder({ lines, pricesIncludeIgv: false, igvAffected: true, expenses: 30 });
    expect(preview).toMatchObject({ units: 34, subtotal: 300, igvAmount: 54, total: 354, expenses: 30 });
    expect(preview.lines[0]).toMatchObject({ quantity: 24, unitCostNet: 10, entryCost: 11 });
    expect(preview.lines[1]).toMatchObject({ quantity: 10, unitCostNet: 6, entryCost: 6.6 });
  });

  it("precios CON IGV en empresa afecta: el costo es sin IGV y el total es lo tipeado", () => {
    const preview = previewOrder({
      lines: [{ purchaseQuantity: 1, purchaseFactor: 1, unitPrice: 118 }],
      pricesIncludeIgv: true,
      igvAffected: true,
      expenses: 0,
    });
    expect(preview).toMatchObject({ subtotal: 100, igvAmount: 18, total: 118 });
    expect(preview.lines[0]).toMatchObject({ unitCostNet: 100, entryCost: 100 });
  });

  it("empresa NO afecta: no separa IGV aunque los precios lo incluyan; el costo es lo pagado", () => {
    const preview = previewOrder({
      lines: [{ purchaseQuantity: 1, purchaseFactor: 1, unitPrice: 118 }],
      pricesIncludeIgv: true,
      igvAffected: false,
      expenses: 0,
    });
    expect(preview).toMatchObject({ subtotal: 118, igvAmount: 0, total: 118 });
    expect(preview.lines[0].unitCostNet).toBe(118);
  });

  it("si toda la OC vale 0, los gastos se reparten por unidades", () => {
    const preview = previewOrder({
      lines: [
        { purchaseQuantity: 3, purchaseFactor: 1, unitPrice: 0 },
        { purchaseQuantity: 1, purchaseFactor: 1, unitPrice: 0 },
      ],
      pricesIncludeIgv: false,
      igvAffected: true,
      expenses: 8,
    });
    expect(preview.lines.map((item) => item.entryCost)).toEqual([2, 2]);
    expect(preview.total).toBe(0);
  });

  it("el formulario cuenta como 0 las líneas con errores", () => {
    const form = { ...emptyOrderForm("2026-11-17"), expenses: "10,5" };
    const good: OrderFormLine = { variantId: "v", label: "Polo", sku: "P", purchaseUnit: "Caja", purchaseFactor: "12", purchaseQuantity: "2", unitPrice: "120" };
    const bad: OrderFormLine = { ...good, variantId: "w", purchaseQuantity: "abc" };
    const preview = previewForm({ ...form, lines: [good, bad] }, true);
    expect(preview).toMatchObject({ units: 24, subtotal: 240, expenses: 10.5 });
  });
});

describe("formulario de la OC", () => {
  const caja: OrderFormLine = { variantId: "v-1", label: "Polo · Talla: M", sku: "POLO-M", purchaseUnit: "Caja", purchaseFactor: "12", purchaseQuantity: "2", unitPrice: "31,8" };

  it("pide proveedor, almacén y al menos un producto; revisa cada línea", () => {
    const form = emptyOrderForm("2026-11-17");
    expect(orderFormProblem(form)).toBe("Elige el proveedor.");
    expect(orderFormProblem({ ...form, supplierId: "s" })).toBe("Elige a qué almacén llega.");
    expect(orderFormProblem({ ...form, supplierId: "s", inventoryId: "i" })).toBe("Agrega al menos un producto.");
    expect(orderFormProblem({ ...form, supplierId: "s", inventoryId: "i", lines: [{ ...caja, purchaseQuantity: "0" }] })).toMatch(
      /Polo · Talla: M: La cantidad va de 1 a/,
    );
    expect(orderFormProblem({ ...form, supplierId: "s", inventoryId: "i", lines: [{ ...caja, unitPrice: "1.23456" }] })).toMatch(
      /hasta 4 decimales/,
    );
    expect(orderFormProblem({ ...form, supplierId: "s", inventoryId: "i", lines: [caja] })).toBeNull();
  });

  it("arma el cuerpo sin montos, con la unidad de compra y sin empresa", () => {
    const form = {
      ...emptyOrderForm("2026-11-17"),
      supplierId: "s",
      inventoryId: "i",
      pricesIncludeIgv: true,
      document: " F001-1 ",
      expenses: "40",
      lines: [caja, { ...caja, variantId: "v-2", purchaseUnit: "Unidad", purchaseFactor: "1", purchaseQuantity: "5", unitPrice: "3" }],
    };
    const body = buildOrderBody(form);
    expect(body).toEqual({
      supplierId: "s",
      inventoryId: "i",
      pricesIncludeIgv: true,
      expenses: 40,
      document: "F001-1",
      notes: null,
      purchaseDate: "2026-11-17",
      receiptType: "FACTURA",
      lines: [
        { variantId: "v-1", purchaseQuantity: 2, purchaseFactor: 12, purchaseUnit: "Caja", unitPrice: 31.8 },
        { variantId: "v-2", purchaseQuantity: 5, purchaseFactor: 1, purchaseUnit: null, unitPrice: 3 },
      ],
    });
    expect(body).not.toHaveProperty("companyId");
    expect(body).not.toHaveProperty("total");
  });

  it("no repite una variante que ya está en la OC", () => {
    const form = { ...emptyOrderForm(), lines: [caja] };
    const { form: next, added } = addFormLines(form, [caja, { ...caja, variantId: "v-9" }]);
    expect(added).toBe(1);
    expect(next.lines.map((item) => item.variantId)).toEqual(["v-1", "v-9"]);
  });

  it("un borrador vuelve al formulario con sus cantidades en unidades de compra", () => {
    const form = formFromOrder(order({ status: "BORRADOR" }));
    expect(form.lines[0]).toMatchObject({ label: "Polo · Talla: M", purchaseUnit: "Caja", purchaseFactor: "12", purchaseQuantity: "2", unitPrice: "120" });
    expect(form.expenses).toBe("30");
  });
});

describe("recepción parcial (H3-D11)", () => {
  const partial = order({
    status: "RECIBIDA_PARCIAL",
    lines: [line({ receivedQuantity: 20, pendingQuantity: 4 }), line({ id: "item-2", variantId: "var-2", quantity: 10, receivedQuantity: 0, pendingQuantity: 10 })],
  });

  it("en el escritorio empieza con lo pendiente; escaneando, en 0", () => {
    expect(receiveDraft(partial, "pending").map((item) => item.quantity)).toEqual(["4", "10"]);
    expect(receiveDraft(partial, "zero").map((item) => item.quantity)).toEqual(["0", "0"]);
    expect(fillPending(receiveDraft(partial, "zero")).map((item) => item.quantity)).toEqual(["4", "10"]);
  });

  it("no deja pasar de lo pendiente", () => {
    const draft = setReceiveQuantity(receiveDraft(partial, "zero"), "item-1", "5");
    expect(receiveLineProblem(draft[0])).toBe("No puedes recibir más de lo pendiente (4).");
    expect(receiveDraftValid(draft)).toBe(false);
    const fixed = setReceiveQuantity(draft, "item-1", "4");
    expect(receiveLineProblem(fixed[0])).toBeNull();
    expect(receiveDraftValid(fixed)).toBe(true);
    expect(buildReceiveLines(fixed)).toEqual([{ itemId: "item-1", quantity: 4 }]);
  });

  it("sin nada por recibir o con texto inválido no se puede enviar", () => {
    expect(receiveDraftValid(receiveDraft(partial, "zero"))).toBe(false);
    const draft = setReceiveQuantity(receiveDraft(partial, "zero"), "item-2", "2.5");
    expect(receiveLineProblem(draft[1])).toBe("Escribe un número entero.");
  });

  it("un escaneo suma 1 a la línea de esa variante hasta completar lo pendiente", () => {
    let draft = receiveDraft(partial, "zero");
    expect(resolveReceiveScan([], draft)).toEqual({ kind: "not_found" });
    expect(resolveReceiveScan([{ variantId: "otra" }], draft)).toEqual({ kind: "not_in_order" });
    for (let i = 0; i < 4; i++) {
      const outcome = resolveReceiveScan([{ variantId: "VAR-1" }], draft);
      expect(outcome).toEqual({ kind: "added", itemId: "item-1" });
      draft = addOneToLine(draft, "item-1");
    }
    expect(resolveReceiveScan([{ variantId: "var-1" }], draft)).toEqual({ kind: "line_complete", itemId: "item-1" });
  });
});

describe("textos", () => {
  it("pago como en el mockup", () => {
    expect(paymentText(order({ status: "BORRADOR" }))).toBe("—");
    expect(paymentText(order({ dueDate: "2026-12-17" }))).toBe("Pendiente · vence 17/12/2026");
    expect(paymentText(order({ paymentStatus: "pagada", paidAt: "2026-11-18T15:00:00Z" }))).toBe("Pagada · 18/11/2026");
  });

  it("fechas de Lima", () => {
    expect(formatDay("2026-11-18T03:00:00Z")).toBe("17/11/2026");
    expect(formatDay(null)).toBe("—");
  });

  it("solo se devuelve lo recibido y no devuelto, sin IMEI/serie", () => {
    const received = order({ status: "RECIBIDA", lines: [line({ receivedQuantity: 24, returnedQuantity: 24 })] });
    expect(canReturnOrder(received)).toBe(false);
    expect(canReturnOrder({ ...received, lines: [line({ receivedQuantity: 24, returnedQuantity: 2 })] })).toBe(true);
    expect(canReturnOrder({ ...received, hasTrackedUnits: true, lines: [line({ receivedQuantity: 24 })] })).toBe(false);
  });
});
