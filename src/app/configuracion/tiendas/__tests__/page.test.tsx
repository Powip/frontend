import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import TiendasPage from "../page";

jest.mock("axios");
// FEAT-24 SEC (sec5): lo de Shopify va con la sesión (ms-integrations cierra esas rutas a JWT).
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: () => "/configuracion/tiendas",
}));
jest.mock("@/components/brands/CatalogoMarcas", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/forms/StoreDeliverySettings", () => ({
  __esModule: true,
  default: (props: any) => <div data-testid={`delivery-${props.storeId}`}>Coberturas: {props.initial.length}</div>,
}));
jest.mock("@/components/forms/GestionAlmacenes", () => ({
  __esModule: true,
  default: () => null,
}));
// Las secciones de la pestaña Almacenes usan axiosAuth (axios está simulado acá).
jest.mock("@/components/shopify-stock/ShopifyStockSection", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/stock-rules/ReservationRulesSection", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/stock-rules/InventoryRulesSection", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/couriers/GestionCouriers", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/stores/StoreSalesChannels", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="channels">
      <span>Canales por tienda</span>
      <span>{props.stores.map((s: any) => s.name).join(",")}</span>
      <span>Destino: {props.initialStoreId}</span>
      <span>Puede configurar: {String(props.canManage)}</span>
    </div>
  ),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
const companyId = "company-a";
const owner = "user-a";
const shop = {
  id: "store-a",
  company_id: companyId,
  name: "LIVII",
  description: "Tienda comercial",
  url_web: "livii.pe",
  is_active: true,
  is_legacy: false,
};
const legacy = {
  id: "legacy-store",
  company_id: companyId,
  name: "Tienda de Corporación",
  description: "Automática",
  url_web: null,
  is_active: true,
  is_legacy: true,
};
const auth = {
  accessToken: "test-token",
  user: {
    id: owner,
    role: "OWNER",
    email: "owner@example.test",
    permissions: [],
  },
  company: { id: companyId, userId: owner, name: "Corporación" },
  subscription: null,
  exp: 9999999999,
};
const push = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/configuracion/tiendas");
  jest.mocked(useRouter).mockReturnValue({ push } as any);
  jest.mocked(useAuth).mockReturnValue({
    auth,
    logout: jest.fn(),
    updateCompany: jest.fn(),
  } as any);
  jest
    .mocked(axios.get)
    .mockImplementation(async (url) =>
      String(url).includes("shopify/status")
        ? { data: [] }
        : { data: { id: companyId, stores: [shop, legacy] } },
    );
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [] });
});

describe("Configuración de tiendas comerciales", () => {
  it("restores the Tiendas tab and keeps the inherited inventory owner out of new configuration", async () => {
    render(<TiendasPage />);
    expect(await screen.findByText(shop.name)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tiendas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText(legacy.name)).not.toBeInTheDocument();
    expect(
      screen.getByText(/La tienda inicial conserva sus ventas y almacenes/),
    ).toBeInTheDocument();
  });
  it("opens the channel configuration for the exact store selected from its card", async () => {
    render(<TiendasPage />);
    const user = userEvent.setup();
    await screen.findByText(shop.name);
    await user.click(screen.getByRole("button", { name: "Canales" }));
    const target = await screen.findByTestId("channels");
    expect(target).toHaveTextContent(shop.name);
    expect(target).toHaveTextContent(`Destino: ${shop.id}`);
    expect(target).not.toHaveTextContent(legacy.name);
  });
  it("uses the advertising deep link to open the store's channel tab", async () => {
    window.history.replaceState({}, "", `/configuracion/tiendas?tab=canales&storeId=${shop.id}`);
    render(<TiendasPage />);
    const target = await screen.findByTestId("channels");
    expect(target).toHaveTextContent(`Destino: ${shop.id}`);
    expect(screen.getByRole("tab", { name: "Canales de Venta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("allows the exact manage capability rather than inventing permission from an email", async () => {
    window.history.replaceState({}, "", "/configuracion/tiendas?tab=canales");
    jest.mocked(useAuth).mockReturnValue({
      auth: {
        ...auth,
        user: {
          ...auth.user,
          id: "staff",
          role: "SELLER",
          permissions: ["MANAGE_ADVERTISING_CONNECTIONS"],
        },
      },
      logout: jest.fn(),
      updateCompany: jest.fn(),
    } as any);
    render(<TiendasPage />);
    expect(await screen.findByTestId("channels")).toHaveTextContent("Puede configurar: true");
    expect(push).not.toHaveBeenCalled();
  });
  it("does not show a store from another company even in a malformed company response", async () => {
    jest.mocked(axios.get).mockImplementation(async (url) =>
      String(url).includes("shopify/status")
        ? { data: [] }
        : {
            data: {
              id: companyId,
              stores: [{ ...shop, company_id: "foreign" }],
            },
          },
    );
    render(<TiendasPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las tiendas");
    expect(screen.queryByText(shop.name)).not.toBeInTheDocument();
  });
  it("redirects an actor without administration access or manage capability", async () => {
    jest.mocked(useAuth).mockReturnValue({
      auth: {
        ...auth,
        user: { ...auth.user, id: "staff", role: "SELLER", permissions: [] },
      },
      logout: jest.fn(),
      updateCompany: jest.fn(),
    } as any);
    render(<TiendasPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByTestId("channels")).not.toBeInTheDocument();
  });
});

it("opens delivery coverage for commercial stores without exposing the inherited store", async () => {
  render(<TiendasPage />);
  await screen.findByText(shop.name);
  await userEvent.setup().click(screen.getByRole("tab", { name: "Envíos" }));
  expect(await screen.findByTestId(`delivery-${shop.id}`)).toHaveTextContent("Coberturas: 0");
  expect(screen.queryByTestId(`delivery-${legacy.id}`)).not.toBeInTheDocument();
});

describe("Shopify en Tiendas, con la sesión (FEAT-24 SEC)", () => {
  const connected = [
    { isConnected: true, shop_url: "livii.myshopify.com", store_id: shop.id, inventory_id: "inv-a" },
  ];

  it("pide el estado de Shopify con axiosAuth y nunca con axios sin token", async () => {
    render(<TiendasPage />);
    await screen.findByText(shop.name);

    await waitFor(() =>
      expect(axiosAuth.get).toHaveBeenCalledWith(expect.stringContaining(`/shopify/status/${companyId}`)),
    );
    expect(jest.mocked(axios.get).mock.calls.some(([url]) => String(url).includes("shopify"))).toBe(false);
  });

  it("«Sincronizar» de una tienda y «Sincronizar con Shopify» van con la sesión y sin cuerpo", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: connected });
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: { total_found: 0, orders_synced: 0 } });
    const user = userEvent.setup();
    render(<TiendasPage />);
    await screen.findByText(shop.name);

    await user.click(await screen.findByRole("button", { name: "Sincronizar" }));
    await user.click(screen.getByRole("button", { name: "Sincronizar con Shopify" }));

    await waitFor(() => expect(axiosAuth.post).toHaveBeenCalledTimes(2));
    for (const [url, body] of jest.mocked(axiosAuth.post).mock.calls) {
      expect(url).toMatch(/\/shopify\/sync\/livii\.myshopify\.com$/);
      expect(body).toEqual({});
    }
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("si quien sincroniza no es administrador (403), lo dice", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: connected });
    jest.mocked(axiosAuth.post).mockRejectedValue({ response: { status: 403 } });
    const user = userEvent.setup();
    render(<TiendasPage />);
    await screen.findByText(shop.name);

    await user.click(await screen.findByRole("button", { name: "Sincronizar" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Solo un administrador de la empresa puede sincronizar con Shopify."),
    );
  });
});
