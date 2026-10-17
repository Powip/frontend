import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { tokenStore } from "@/lib/tokenStore";
import { updateProductImage, validateProductImage } from "../productImageService";

const IMAGE_URL = "https://files.example.test/new-product.png";
const initialAdapter = axiosAuth.defaults.adapter;
const initialProductsApi = process.env.NEXT_PUBLIC_API_PRODUCTOS;
let requests: InternalAxiosRequestConfig[];
let adapter: jest.MockedFunction<AxiosAdapter>;

function image(type = "image/png", size = 4) {
  return new File([new Uint8Array(size)], "producto.png", { type });
}

beforeEach(() => {
  requests = [];
  tokenStore.set("product-image-test-token");
  process.env.NEXT_PUBLIC_API_PRODUCTOS = "https://products.example.test/";
  adapter = jest.fn(async (config) => {
    requests.push(config);
    return {
      config,
      status: 200,
      statusText: "OK",
      headers: {},
      data: config.method === "get" ? { product: { id: "resolved-product" } } :
        config.method === "post" ? IMAGE_URL : { id: "product-a", imageUrl: IMAGE_URL },
    };
  });
  axiosAuth.defaults.adapter = adapter;
});

afterEach(() => {
  axiosAuth.defaults.adapter = initialAdapter;
  tokenStore.set(null);
  if (initialProductsApi === undefined) delete process.env.NEXT_PUBLIC_API_PRODUCTOS;
  else process.env.NEXT_PUBLIC_API_PRODUCTOS = initialProductsApi;
});

describe("product image updates", () => {
  it("uploads the file and patches only the product image using the session bearer token", async () => {
    const file = image();
    await expect(updateProductImage({ productId: "product-a", variantId: "variant-a", file }))
      .resolves.toBe(IMAGE_URL);

    expect(requests.map(({ method, url }) => [method, url])).toEqual([
      ["post", "https://products.example.test/cloudinary/uploadImage"],
      ["patch", "https://products.example.test/products/product-a"],
    ]);
    const upload = requests[0];
    expect(upload.responseType).toBe("text");
    expect(upload.data).toBeInstanceOf(FormData);
    const uploadedFile = (upload.data as FormData).get("file") as File;
    expect(uploadedFile.name).toBe(file.name);
    expect(uploadedFile.size).toBe(file.size);
    expect(uploadedFile.type).toBe(file.type);
    expect(JSON.parse(requests[1].data)).toEqual({ imageUrl: IMAGE_URL });
    for (const request of requests) {
      expect(request.headers.get("Authorization")).toBe("Bearer product-image-test-token");
    }
  });

  it("resolves a missing product ID from its variant before uploading", async () => {
    await updateProductImage({ variantId: "variant-a", file: image() });
    expect(requests.map(({ method, url }) => [method, url])).toEqual([
      ["get", "https://products.example.test/product-variant/variant-a"],
      ["post", "https://products.example.test/cloudinary/uploadImage"],
      ["patch", "https://products.example.test/products/resolved-product"],
    ]);
    expect(requests[0].headers.get("Authorization")).toBe("Bearer product-image-test-token");
  });

  it("falls back to the gateway when the products API is unset", async () => {
    delete process.env.NEXT_PUBLIC_API_PRODUCTOS;
    await updateProductImage({ productId: "product-a", variantId: "variant-a", file: image() });
    expect(requests[0].url).toBe(`${GATEWAY.products}/cloudinary/uploadImage`);
    expect(requests[1].url).toBe(`${GATEWAY.products}/products/product-a`);
  });

  it("does not patch or report success when the image upload fails", async () => {
    const uploadError = new Error("Storage unavailable");
    adapter.mockImplementation(async (config) => {
      requests.push(config);
      throw uploadError;
    });
    await expect(updateProductImage({ productId: "product-a", variantId: "variant-a", file: image() }))
      .rejects.toBe(uploadError);
    expect(requests.map(({ method }) => method)).toEqual(["post"]);
  });

  it("rejects an unresolved product before uploading any file", async () => {
    adapter.mockResolvedValueOnce({
      config: {} as InternalAxiosRequestConfig,
      status: 200,
      statusText: "OK",
      headers: {},
      data: { product: null },
    });
    await expect(updateProductImage({ variantId: "missing-variant", file: image() }))
      .rejects.toThrow("No se pudo identificar el producto");
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].method).toBe("get");
  });

  it("rejects invalid files before making requests", async () => {
    await expect(updateProductImage({ productId: "product-a", variantId: "variant-a", file: image("text/html") }))
      .rejects.toThrow("JPG, PNG, WebP o GIF");
    expect(adapter).not.toHaveBeenCalled();
  });
});

describe("product image validation", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])("accepts %s", (type) => {
    expect(validateProductImage(image(type))).toBeNull();
  });

  it("accepts up to 5 MB and rejects larger, empty, or unsupported files", () => {
    expect(validateProductImage(image("image/png", 5 * 1024 * 1024))).toBeNull();
    expect(validateProductImage(image("image/png", 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
    expect(validateProductImage(image("image/png", 0))).toMatch(/vacía/);
    expect(validateProductImage(image("image/svg+xml"))).toMatch(/JPG, PNG, WebP o GIF/);
  });
});
