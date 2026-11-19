import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  cancelPurchaseOrder,
  cancelSupplierReturn,
  createPurchaseOrder,
  createPurchaseSupplier,
  createSupplierReturn,
  getVariantCosts,
  listPurchasableProducts,
  listProductVariants,
  listPurchaseOrders,
  listPurchaseSuppliers,
  listSupplierReturns,
  placePurchaseOrder,
  receivePurchaseOrder,
  registerCreditNote,
  sendSupplierReturn,
  setPurchaseOrderPayment,
  setVariantCosts,
  updatePurchaseOrder,
  updatePurchaseSupplier,
  type SavePurchaseOrderBody,
} from "../purchasesService";

// FEAT-24 H3-E — servicio de compras: todo por la fachada de ms-products
// (/purchase-orders, /supplier-returns, /purchase-suppliers, /variant-costs),
// sin companyId (la empresa sale del token).

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

const P = GATEWAY.products;
const body: SavePurchaseOrderBody = {
  supplierId: "s-1",
  inventoryId: "i-1",
  pricesIncludeIgv: false,
  expenses: 0,
  document: null,
  notes: null,
  purchaseDate: "2026-11-17",
  receiptType: "FACTURA",
  lines: [{ variantId: "v-1", purchaseQuantity: 2, purchaseFactor: 12, purchaseUnit: "Caja", unitPrice: 120 }],
};

const initialProductsApi = process.env.NEXT_PUBLIC_API_PRODUCTOS;
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.NEXT_PUBLIC_API_PRODUCTOS;
});
afterAll(() => {
  if (initialProductsApi === undefined) delete process.env.NEXT_PUBLIC_API_PRODUCTOS;
  else process.env.NEXT_PUBLIC_API_PRODUCTOS = initialProductsApi;
});

describe("órdenes de compra", () => {
  it("lista con filtros (sin vacíos) y normaliza la página", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { items: [{ id: "oc-1" }], total: 1, page: 2, limit: 10 } });
    await expect(listPurchaseOrders({ status: "PEDIDA", supplierId: undefined, page: 2, limit: 10 })).resolves.toEqual({
      items: [{ id: "oc-1" }],
      total: 1,
      page: 2,
      limit: 10,
    });
    expect(axiosAuth.get).toHaveBeenCalledWith(`${P}/purchase-orders`, { params: { status: "PEDIDA", page: 2, limit: 10 }, signal: undefined });
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: {} });
    await expect(listPurchaseOrders()).resolves.toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });

  it("alta, edición y emisión", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { id: "oc-1" } });
    jest.mocked(axiosAuth.put).mockResolvedValue({ data: { id: "oc-1" } });
    await createPurchaseOrder(body);
    expect(axiosAuth.post).toHaveBeenCalledWith(`${P}/purchase-orders`, body);
    await updatePurchaseOrder("oc-1", body);
    expect(axiosAuth.put).toHaveBeenCalledWith(`${P}/purchase-orders/oc-1`, body);
    await placePurchaseOrder("oc-1");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${P}/purchase-orders/oc-1/order`);
  });

  it("recibe con operationId y, desde la cola, con timeout", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { duplicate: false } });
    const receive = { lines: [{ itemId: "item-1", quantity: 3 }], operationId: "op-1" };
    await receivePurchaseOrder("oc-1", receive);
    expect(axiosAuth.post).toHaveBeenCalledWith(`${P}/purchase-orders/oc-1/receive`, receive);
    await receivePurchaseOrder("oc-1", receive, { timeoutMs: 15000 });
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${P}/purchase-orders/oc-1/receive`, receive, { timeout: 15000 });
  });

  it("anula con motivo y devuelve la OC; el pago manda la fecha solo si está pagada", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValueOnce({ data: { purchaseOrder: { id: "oc-1", status: "ANULADA" } } });
    await expect(cancelPurchaseOrder("oc-1", "El proveedor canceló")).resolves.toEqual({ id: "oc-1", status: "ANULADA" });
    expect(axiosAuth.post).toHaveBeenCalledWith(`${P}/purchase-orders/oc-1/cancel`, { reason: "El proveedor canceló" });

    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { id: "oc-1" } });
    await setPurchaseOrderPayment("oc-1", "pagada", "2026-11-18");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${P}/purchase-orders/oc-1/payment`, { status: "pagada", paidAt: "2026-11-18" });
    await setPurchaseOrderPayment("oc-1", "pendiente", "2026-11-18");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${P}/purchase-orders/oc-1/payment`, { status: "pendiente" });
  });
});

describe("devoluciones a proveedor", () => {
  it("lista, crea, envía, registra la nota de crédito y anula", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { items: [{ id: "d-1" }] } });
    await expect(listSupplierReturns({ status: "enviada" })).resolves.toEqual([{ id: "d-1" }]);
    expect(axiosAuth.get).toHaveBeenCalledWith(`${P}/supplier-returns`, { params: { status: "enviada" }, signal: undefined });

    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { id: "d-1" } });
    const create = { purchaseOrderId: "oc-1", reason: "Costuras abiertas", lines: [{ itemId: "item-1", quantity: 2 }] };
    await createSupplierReturn(create);
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${P}/supplier-returns`, create);
    await sendSupplierReturn("d-1");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${P}/supplier-returns/d-1/send`);
    await registerCreditNote("d-1", "FC01-123");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${P}/supplier-returns/d-1/credit-note`, { number: "FC01-123" });
    await cancelSupplierReturn("d-1");
    expect(axiosAuth.post).toHaveBeenLastCalledWith(`${P}/supplier-returns/d-1/cancel`, {});
  });
});

describe("proveedores de compras", () => {
  it("lista (con o sin inactivos), crea y edita en /purchase-suppliers", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { items: [{ id: "s-1" }] } });
    await expect(listPurchaseSuppliers(true)).resolves.toEqual([{ id: "s-1" }]);
    expect(axiosAuth.get).toHaveBeenCalledWith(`${P}/purchase-suppliers`, { params: { includeInactive: "true" }, signal: undefined });

    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { id: "s-1" } });
    jest.mocked(axiosAuth.put).mockResolvedValue({ data: { id: "s-1" } });
    await createPurchaseSupplier({ businessName: "Textiles SAC", ruc: "20100047218", paymentTerms: "credito_30" });
    expect(axiosAuth.post).toHaveBeenCalledWith(`${P}/purchase-suppliers`, { businessName: "Textiles SAC", ruc: "20100047218", paymentTerms: "credito_30" });
    await updatePurchaseSupplier("s-1", { active: false });
    expect(axiosAuth.put).toHaveBeenCalledWith(`${P}/purchase-suppliers/s-1`, { active: false });
  });
});

describe("costo promedio", () => {
  it("lee de a 1000 variantes, sin repetir", async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `v-${index}`);
    jest.mocked(axiosAuth.post).mockImplementation(async (_url, payload) => ({
      data: (payload as { variantIds: string[] }).variantIds.map((variantId) => ({ variantId, averageCost: null })),
    }));
    const costs = await getVariantCosts([...ids, "v-0"]);
    expect(costs).toHaveLength(1001);
    expect(axiosAuth.post).toHaveBeenCalledTimes(2);
    expect(jest.mocked(axiosAuth.post).mock.calls[0][0]).toBe(`${P}/variant-costs`);
    await expect(getVariantCosts([])).resolves.toEqual([]);
  });

  it("la carga manual va por PUT con operationId", async () => {
    jest.mocked(axiosAuth.put).mockResolvedValue({ data: { items: [{ variantId: "v-1", previous: null, averageCost: 12 }], duplicate: false } });
    await expect(setVariantCosts({ items: [{ variantId: "v-1", averageCost: 12 }], operationId: "op-1" })).resolves.toEqual({
      items: [{ variantId: "v-1", previous: null, averageCost: 12 }],
      duplicate: false,
    });
    expect(axiosAuth.put).toHaveBeenCalledWith(`${P}/variant-costs`, { items: [{ variantId: "v-1", averageCost: 12 }], operationId: "op-1" });
  });
});

describe("catálogo para la OC", () => {
  it("productos con su unidad de compra y variantes del producto", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValueOnce({
      data: [
        { id: "p-1", name: "Polo", sku: "POLO", companySku: null, status: true, purchaseUnit: "Caja", purchaseFactor: 12 },
        { id: "p-2", name: "Gorra", sku: "GOR", status: false, purchaseUnit: null, purchaseFactor: null },
        null,
      ],
    });
    await expect(listPurchasableProducts("c-1")).resolves.toEqual([
      { id: "p-1", name: "Polo", sku: "POLO", companySku: null, status: true, purchaseUnit: "Caja", purchaseFactor: 12 },
      { id: "p-2", name: "Gorra", sku: "GOR", companySku: null, status: false, purchaseUnit: null, purchaseFactor: 1 },
    ]);
    expect(axiosAuth.get).toHaveBeenCalledWith(`${P}/products/company/c-1`, { signal: undefined });

    jest.mocked(axiosAuth.get).mockResolvedValueOnce({
      data: [{ id: "v-1", sku: "POLO-M", attributeValues: { Talla: "M" }, isActive: true, mergedInto: null }],
    });
    await expect(listProductVariants("p-1")).resolves.toEqual([
      { id: "v-1", sku: "POLO-M", companySku: null, attributeValues: { Talla: "M" }, isActive: true, mergedInto: null },
    ]);
    expect(axiosAuth.get).toHaveBeenLastCalledWith(`${P}/product-variant/by-product/p-1`);
  });
});
