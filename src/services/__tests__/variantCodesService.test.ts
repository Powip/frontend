import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { fetchVariantsByIds, lookupVariantsByCodes } from "../variantCodesService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const COMPANY = "c-1";

describe("variantes para Recepciones (FEAT-24 H2-F)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_API_PRODUCTOS;
  });

  it("trae las variantes por id y descarta las de otra empresa", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({
      data: [
        {
          id: "v1",
          sku: "POW-1",
          companySku: "",
          barcode: "7750000000001",
          powipEan: "2000000000015",
          attributeValues: { Talla: "M" },
          product: { name: "Polo", companyId: COMPANY },
        },
        { id: "v2", sku: "AJENO", attributeValues: {}, product: { name: "Ajeno", companyId: "otra" } },
      ],
    });
    await expect(fetchVariantsByIds(["v1", "v2", "v1"], COMPANY)).resolves.toEqual([
      {
        id: "v1",
        sku: "POW-1",
        companySku: null,
        barcode: "7750000000001",
        powipEan: "2000000000015",
        attributeValues: { Talla: "M" },
        productName: "Polo",
      },
    ]);
    expect(axiosAuth.post).toHaveBeenCalledWith(`${GATEWAY.products}/product-variant/multiple/by-ids`, { ids: ["v1", "v2"] });
  });

  it("FEAT-24 H5-L: marca las variantes de productos que manejan lotes", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({
      data: [{ id: "v1", sku: "CREMA", attributeValues: {}, product: { name: "Crema", companyId: COMPANY, tracksLots: true } }],
    });
    const [variant] = await fetchVariantsByIds(["v1"], COMPANY);
    expect(variant.tracksLots).toBe(true);
  });

  it("parte los ids en bloques de 200 y no llama sin ids", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: [] });
    await fetchVariantsByIds([], COMPANY);
    expect(axiosAuth.post).not.toHaveBeenCalled();
    await fetchVariantsByIds(Array.from({ length: 450 }, (_, i) => `v${i}`), COMPANY);
    expect(axiosAuth.post).toHaveBeenCalledTimes(3);
  });

  it("resuelve códigos con includeBarcodes y la empresa (ese endpoint no la lee del token)", async () => {
    process.env.NEXT_PUBLIC_API_PRODUCTOS = "https://products.example.test";
    const matches = [{ code: "7750000000001", variantId: "v1", sku: "POW-1", companySku: null, productId: "p", productName: "Polo", matchedBy: "barcode" }];
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: matches });
    await expect(lookupVariantsByCodes([" 7750000000001 "], COMPANY)).resolves.toEqual(matches);
    expect(axiosAuth.post).toHaveBeenCalledWith("https://products.example.test/product-variant/lookup-by-codes", {
      companyId: COMPANY,
      codes: ["7750000000001"],
      includeBarcodes: true,
    });
    jest.mocked(axiosAuth.post).mockClear();
    await expect(lookupVariantsByCodes(["  "], COMPANY)).resolves.toEqual([]);
    expect(axiosAuth.post).not.toHaveBeenCalled();
  });
});
