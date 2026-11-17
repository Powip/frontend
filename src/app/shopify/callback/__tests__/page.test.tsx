/**
 * Tests: callback de OAuth de Shopify (FEAT-24 H1-D, R10).
 * El backend ya no manda el access token en la URL: avisa con `status=connected`
 * (y por un tiempo `token=connected`). La pantalla acepta cualquiera de los dos.
 */

import { render, screen } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { isConnectedCallback } from "@/lib/shopifyCallback";
import ShopifyCallbackPage from "../page";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "company-a", stores: [{ id: "store-a" }] } } }),
}));
jest.mock("../../components/shopify-sync-config-modal", () => ({
  ShopifySyncConfigModal: ({ isOpen, shopUrl }: { isOpen: boolean; shopUrl: string }) =>
    isOpen ? <div data-testid="sync-modal">{shopUrl}</div> : null,
}));

const withParams = (query: string) => jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as never);

describe("Callback de Shopify", () => {
  it("acepta status=connected sin token", async () => {
    withParams("shop=uno.myshopify.com&status=connected");
    render(<ShopifyCallbackPage />);
    expect(await screen.findByText("¡Conexión exitosa con uno.myshopify.com!")).toBeInTheDocument();
    expect(screen.getByTestId("sync-modal")).toHaveTextContent("uno.myshopify.com");
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
});
