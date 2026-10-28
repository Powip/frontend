import axiosAuth from "@/lib/axiosAuth";
import {
  getQuotationCatalog,
  getQuotationInventories,
  searchQuotationCustomers,
  uploadQuotationLineImage,
} from "../quotationService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
beforeEach(() => jest.clearAllMocks());

it("keeps authenticated customer and warehouse requests scoped to the selected store and cancellation signal", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [] });
  const controller = new AbortController();
  await searchQuotationCustomers({ storeId: "store-A", search: "987654321" }, controller.signal);
  await getQuotationInventories("store-A", controller.signal);
  await getQuotationCatalog(
    { storeId: "store-A", inventoryId: "warehouse-A", search: "SKU", page: 2, limit: 30 },
    controller.signal,
  );
  expect(axiosAuth.get).toHaveBeenNthCalledWith(
    1,
    expect.stringMatching(/\/quotations\/customers$/),
    { params: { storeId: "store-A", search: "987654321" }, signal: controller.signal },
  );
  expect(axiosAuth.get).toHaveBeenNthCalledWith(
    2,
    expect.stringMatching(/\/quotations\/inventories$/),
    { params: { storeId: "store-A" }, signal: controller.signal },
  );
  expect(axiosAuth.get).toHaveBeenNthCalledWith(
    3,
    expect.stringMatching(/\/quotations\/catalog$/),
    {
      params: { storeId: "store-A", inventoryId: "warehouse-A", search: "SKU", page: 2, limit: 30 },
      signal: controller.signal,
    },
  );
});

it("rejects PDF/SVG and oversized manual-product photos before uploading, while allowing image evidence", async () => {
  await expect(
    uploadQuotationLineImage("store-A", new File(["pdf"], "file.pdf", { type: "application/pdf" })),
  ).rejects.toThrow("JPG, PNG o WebP");
  await expect(
    uploadQuotationLineImage(
      "store-A",
      new File(["<svg/>"], "file.svg", { type: "image/svg+xml" }),
    ),
  ).rejects.toThrow("JPG, PNG o WebP");
  const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
    type: "image/png",
  });
  await expect(uploadQuotationLineImage("store-A", tooLarge)).rejects.toThrow("máximo 5 MB");
  expect(axiosAuth.post).not.toHaveBeenCalled();
  jest
    .mocked(axiosAuth.post)
    .mockResolvedValue({ data: { imageUrl: "https://cdn.example/photo.png" } });
  const image = new File(["png"], "product.png", { type: "image/png" });
  await expect(uploadQuotationLineImage("store-A", image)).resolves.toBe(
    "https://cdn.example/photo.png",
  );
  const [url, body, config] = jest.mocked(axiosAuth.post).mock.calls[0];
  expect(url).toMatch(/\/quotations\/line-image$/);
  expect((body as FormData).get("file")).toBe(image);
  expect(config).toEqual({ params: { storeId: "store-A" } });
});
