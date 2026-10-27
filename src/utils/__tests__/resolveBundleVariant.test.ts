import type { BundleProductRef } from "@/interfaces/IPack";
import type { InventoryItemForSale } from "@/interfaces/IProduct";
import axiosAuth from "@/lib/axiosAuth";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import { resolveBundleVariant } from "@/utils/resolveBundleVariant";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/services/inventoryItems.service", () => ({ searchInventoryItems: jest.fn() }));

const ref: BundleProductRef = {
  productKey: "Nombre guardado", productName: "Nombre guardado", price: 99,
  variantId: "variant-300", sku: "SKU-ANTIGUO", attributes: { Tamaño: "300 g" },
};
const variant150: InventoryItemForSale = {
  inventoryItemId: "item-150", variantId: "variant-150", productName: "Nombre actual",
  sku: "SKU-150", price: 49, availableStock: 100, physicalStock: 100,
  attributes: { Tamaño: "150 g" }, trackingMode: "NONE",
};
const variant300: InventoryItemForSale = {
  ...variant150, inventoryItemId: "item-300", variantId: "variant-300", sku: "SKU-300-ACTUAL",
  price: 99, availableStock: 0, physicalStock: 1, reservedStock: 1,
  attributes: { Tamaño: "300 g" }, trackingMode: "SERIAL",
};
const scope = { companyId: "company-1", inventoryId: "inventory-1" };
const page = (data: InventoryItemForSale[], totalPages = 1) => ({
  data, meta: { page: 1, limit: 100, total: data.length, totalPages },
});

beforeEach(() => {
  jest.resetAllMocks();
  (axiosAuth.get as jest.Mock).mockResolvedValue({ data: {
    id: ref.variantId, sku: "SKU-300-ACTUAL", isActive: true,
    product: { name: "Nombre actual", companyId: "company-1", status: true },
  } });
});

test("sales resolves exact 300 g on a later page and preserves the current tracking/stock row", async () => {
  (searchInventoryItems as jest.Mock)
    .mockResolvedValueOnce(page([variant150], 2))
    .mockResolvedValueOnce(page([variant300], 2));
  const resolved = await resolveBundleVariant(ref, scope);
  expect(resolved).toBe(variant300);
  expect(resolved).toEqual(expect.objectContaining({
    variantId: "variant-300", inventoryItemId: "item-300", trackingMode: "SERIAL",
    attributes: { Tamaño: "300 g" }, availableStock: 0, reservedStock: 1,
  }));
  expect(searchInventoryItems).toHaveBeenNthCalledWith(1, {
    ...scope, q: "SKU-300-ACTUAL", page: 1, limit: 100,
  });
  expect(searchInventoryItems).toHaveBeenNthCalledWith(2, {
    ...scope, q: "SKU-300-ACTUAL", page: 2, limit: 100,
  });
  expect(axiosAuth.get).toHaveBeenCalledWith(expect.stringContaining("/product-variant/variant-300"));
});

test("missing exact variant never substitutes the 150 g variant with greater stock", async () => {
  (searchInventoryItems as jest.Mock).mockResolvedValue(page([variant150]));
  await expect(resolveBundleVariant(ref, scope)).resolves.toBeNull();
  expect(searchInventoryItems).toHaveBeenCalledTimes(1);
});

test.each([
  { id: "variant-300", isActive: false, product: { companyId: "company-1" } },
  { id: "variant-300", product: { companyId: "another-company" } },
  { id: "variant-300", product: { companyId: "company-1", status: false } },
  { id: "wrong-id", product: { companyId: "company-1" } },
])("inactive, foreign-company or mismatched metadata is rejected before inventory search: %j", async (data) => {
  (axiosAuth.get as jest.Mock).mockResolvedValue({ data });
  await expect(resolveBundleVariant(ref, scope)).resolves.toBeNull();
  expect(searchInventoryItems).not.toHaveBeenCalled();
});

test("a present invalid variant reference fails closed without legacy name lookup", async () => {
  await expect(resolveBundleVariant({ ...ref, variantId: undefined }, scope)).resolves.toBeNull();
  expect(axiosAuth.get).not.toHaveBeenCalled();
  expect(searchInventoryItems).not.toHaveBeenCalled();
});

test("without a current SKU the bounded search uses the current product name", async () => {
  (axiosAuth.get as jest.Mock).mockResolvedValue({ data: {
    id: ref.variantId, sku: "", product: { companyId: "company-1", name: "Nombre actual" },
  } });
  (searchInventoryItems as jest.Mock).mockResolvedValue(page([variant300]));
  await expect(resolveBundleVariant(ref, scope)).resolves.toBe(variant300);
  expect(searchInventoryItems).toHaveBeenCalledWith(expect.objectContaining({ q: "Nombre actual" }));
});

test("quotation adapter searches current SKU in the store catalog and still selects only the exact ID", async () => {
  const search = jest.fn().mockResolvedValue({ data: [variant150, variant300] });
  await expect(resolveBundleVariant(ref, { search })).resolves.toBe(variant300);
  expect(search).toHaveBeenCalledWith("SKU-300-ACTUAL", 1);
  expect(searchInventoryItems).not.toHaveBeenCalled();
});

test("quotation catalog missing 300 g fails closed even if 150 g is returned", async () => {
  const search = jest.fn().mockResolvedValue({ data: [variant150] });
  await expect(resolveBundleVariant(ref, { search })).resolves.toBeNull();
  expect(search).toHaveBeenCalledTimes(1);
});
