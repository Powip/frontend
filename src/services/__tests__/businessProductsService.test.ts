jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
import axiosAuth from "@/lib/axiosAuth";
import { fetchBusinessProducts, scopeBusinessProducts } from "../businessProductsService";
import { BusinessInventoryItem } from "../businessInventoryItemsService";

const get = jest.mocked(axiosAuth.get);
const stocked = { id: "stocked", companyId: "company-a", name: "Camisa", sku: "C-1", status: true, priceVta: 20 };
const noStock = { ...stocked, id: "empty", name: "Pantalón", status: false };
const rows = [{ productId: "stocked" }] as BusinessInventoryItem[];

describe("Business product catalog", () => {
  beforeEach(() => get.mockReset());
  it("requests the JWT company report, retaining inactive and unstocked products once", async () => {
    get.mockResolvedValue({ data: { data: [stocked, noStock, stocked] } });
    const signal = new AbortController().signal;
    const products = await fetchBusinessProducts({ companyId: "company-a", accessToken: "test-token", signal });
    expect(products).toHaveLength(2);
    expect(scopeBusinessProducts(products, rows, "business", "")).toHaveLength(2);
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/products/report"), { headers: { Authorization: "Bearer test-token" }, signal });
  });
  it("restricts store catalog by actual warehouse product positions, with name and SKU search", () => {
    expect(scopeBusinessProducts([stocked, noStock], rows, "store", "")).toEqual([stocked]);
    expect(scopeBusinessProducts([stocked, noStock], rows, "business", "c-1")).toHaveLength(2);
    expect(scopeBusinessProducts([stocked, noStock], rows, "business", "pantalón")).toEqual([noStock]);
  });
  it("rejects a report containing another company's product", async () => {
    get.mockResolvedValue({ data: { data: [{ ...stocked, companyId: "other-company" }] } });
    await expect(fetchBusinessProducts({ companyId: "company-a", accessToken: "test-token" })).rejects.toThrow("negocio activo");
  });
  it("surfaces authentication failure rather than returning an empty catalog", async () => {
    get.mockRejectedValue(new Error("401 Unauthorized"));
    await expect(fetchBusinessProducts({ companyId: "company-a", accessToken: "test-token" })).rejects.toThrow("401");
  });
});
