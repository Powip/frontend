/**
 * Tests: callback de OAuth de Shopify (FEAT-24 H1-D, R10).
 * El backend ya no manda el access token en la URL: avisa con `status=connected`
 * (y por un tiempo `token=connected`). La pantalla acepta cualquiera de los dos.
 */

import { render, screen } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { isConnectedCallback } from "@/lib/shopifyCallback";
import { getShopifyStatus } from "@/services/shopifyService";
import ShopifyCallbackPage from "../page";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      company: {
        id: "company-a",
        stores: [
          { id: "store-a", name: "Tienda A" },
          { id: "store-b", name: "Tienda B" },
        ],
      },
    },
  }),
}));
jest.mock("@/services/shopifyService", () => ({ getShopifyStatus: jest.fn() }));
jest.mock("../../components/shopify-sync-config-modal", () => ({
  ShopifySyncConfigModal: ({
    isOpen,
    shopUrl,
    storeId,
    storeOptions,
  }: {
    isOpen: boolean;
    shopUrl: string;
    storeId: string;
    storeOptions?: { id: string }[];
  }) =>
    isOpen ? (
      <div data-testid="sync-modal" data-store-id={storeId} data-store-options={(storeOptions ?? []).map((s) => s.id).join(",")}>
        {shopUrl}
      </div>
    ) : null,
}));

const withParams = (query: string) => jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as never);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getShopifyStatus).mockResolvedValue([]);
});

describe("Callback de Shopify", () => {
  it("acepta status=connected sin token", async () => {
    withParams("shop=uno.myshopify.com&status=connected");
    render(<ShopifyCallbackPage />);
    expect(await screen.findByText("¡Conexión exitosa con uno.myshopify.com!")).toBeInTheDocument();
    expect(await screen.findByTestId("sync-modal")).toHaveTextContent("uno.myshopify.com");
  });

  it("sigue aceptando el marcador token=connected del backend actual", async () => {
    withParams("shop=uno.myshopify.com&status=connected&token=connected");
    render(<ShopifyCallbackPage />);
    expect(await screen.findByText("¡Conexión exitosa con uno.myshopify.com!")).toBeInTheDocument();
  });

  it("sin status ni token, o sin tienda → faltan parámetros", async () => {
    withParams("shop=uno.myshopify.com");
    const { unmount } = render(<ShopifyCallbackPage />);
    expect(await screen.findByText("Faltan parámetros de autenticación.")).toBeInTheDocument();
    unmount();

    withParams("status=connected");
    render(<ShopifyCallbackPage />);
    expect(await screen.findByText("Faltan parámetros de autenticación.")).toBeInTheDocument();
  });

  it("un error del backend se muestra", async () => {
    withParams("error=HMAC%20inv%C3%A1lido");
    render(<ShopifyCallbackPage />);
    expect(await screen.findByText("Error de conexión: HMAC inválido")).toBeInTheDocument();
  });

  it("isConnectedCallback: status=connected o un token", () => {
    expect(isConnectedCallback(new URLSearchParams("status=connected"))).toBe(true);
    expect(isConnectedCallback(new URLSearchParams("token=connected"))).toBe(true);
    expect(isConnectedCallback(new URLSearchParams("status=error"))).toBe(false);
    expect(isConnectedCallback(new URLSearchParams(""))).toBe(false);
  });

  // FEAT-24 SEC (sec6b): antes se mandaba siempre la primera tienda de la empresa (`stores[0]`).
  it("manda la tienda de Powip vinculada a esa tienda de Shopify, no la primera de la empresa", async () => {
    jest.mocked(getShopifyStatus).mockResolvedValue([
      { isConnected: true, shop_url: "otra.myshopify.com", store_id: "store-a" },
      { isConnected: true, shop_url: "uno.myshopify.com", store_id: "store-b" },
    ]);
    withParams("shop=uno.myshopify.com&status=connected");
    render(<ShopifyCallbackPage />);

    expect(await screen.findByTestId("sync-modal")).toHaveAttribute("data-store-id", "store-b");
    expect(getShopifyStatus).toHaveBeenCalledWith("company-a");
  });

  it("sin vínculo (o si no se puede consultar), no elige ninguna: el modal pide elegir entre las de la empresa", async () => {
    jest.mocked(getShopifyStatus).mockResolvedValue([{ isConnected: true, shop_url: "uno.myshopify.com" }]);
    withParams("shop=uno.myshopify.com&status=connected");
    const { unmount } = render(<ShopifyCallbackPage />);

    const modal = await screen.findByTestId("sync-modal");
    expect(modal).toHaveAttribute("data-store-id", "");
    expect(modal).toHaveAttribute("data-store-options", "store-a,store-b");
    unmount();

    jest.mocked(getShopifyStatus).mockRejectedValue(new Error("caído"));
    render(<ShopifyCallbackPage />);
    expect(await screen.findByTestId("sync-modal")).toHaveAttribute("data-store-id", "");
  });
});
