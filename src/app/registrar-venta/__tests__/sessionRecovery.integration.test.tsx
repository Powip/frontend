import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { cancelSessionRefresh, registerSessionRefresher, requestSessionToken } from "@/lib/sessionRefresh";
import { tokenStore } from "@/lib/tokenStore";
import RegistrarVentaPage from "../page";

// Keep the real editor, serializer, Axios interceptors and refresh transport.
// Only navigation, session publication and unrelated catalog widgets are fixtures.
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/registrar-venta",
  useSearchParams: () => new URLSearchParams("orderId=order-recovery"),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/services/clients.service", () => ({
  fetchClientByPhone: jest.fn(), createClient: jest.fn(), updateClient: jest.fn(),
}));
jest.mock("@/services/promos.service", () => ({
  listVolumePromos: jest.fn().mockResolvedValue([]),
  createVolumePromo: jest.fn(), updatePromo: jest.fn(), deletePromo: jest.fn(),
}));
jest.mock("@/hooks/useCompanyCouriers", () => ({
  useCompanyCouriers: () => ({ couriers: [], loading: false, error: false, retry: jest.fn() }),
}));
jest.mock("@/components/ui/select", () => {
  const Part = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Select: Part, SelectContent: Part, SelectItem: Part, SelectTrigger: Part, SelectValue: () => null,
  };
});
jest.mock("@/components/modals/orderReceiptModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/registrar-venta/ProductSearchMatrix", () => ({
  __esModule: true,
  default: ({ onAddVariant }: { onAddVariant: (item: Record<string, unknown>) => void }) => (
    <button type="button" onClick={() => onAddVariant({
      inventoryItemId: "inventory-new", variantId: "variant-new", productName: "Producto nuevo",
      sku: "NEW", price: 59, availableStock: 10, physicalStock: 10,
    })}>Agregar producto de 59</button>
  ),
}));
jest.mock("@/components/registrar-venta/CartLines", () => ({
  __esModule: true,
  default: ({ cart, onRemove }: {
    cart: { id: string; productName: string; price: number }[];
    onRemove: (id: string) => void;
  }) => <>{cart.map((item) => (
    <div key={item.id}>
      <span>{item.productName}: {item.price}</span>
      <button type="button" onClick={() => onRemove(item.id)}>Quitar {item.productName}</button>
    </div>
  ))}</>,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function fixtureToken(exp: number) {
  const payload = { id: "user-recovery", companyId: "company-recovery", exp };
  return `${btoa('{"alg":"none"}')}.${btoa(JSON.stringify(payload))}.fixture`;
}

const SCOPE = JSON.stringify(["user-recovery", "company-recovery"]);
const SALE_CONTEXT = {
  companyId: "company-recovery",
  stores: [{ id: "store-recovery", name: "Tienda sintética" }],
  inventories: [{ id: "warehouse-recovery", name: "Almacén sintético", storeId: "store-recovery" }],
};
const CUSTOMER = {
  id: "customer-recovery", companyId: "company-recovery", fullName: "Cliente sintético",
  phoneNumber: "999000111", clientType: "TRADICIONAL", province: "Lima", city: "Lima",
  district: "Miraflores", address: "Dirección sintética", isActive: true,
};
const ORDER = {
  id: "order-recovery", storeId: "store-recovery", customer: CUSTOMER,
  orderType: "VENTA", status: "PENDIENTE", salesChannel: "WHATSAPP", closingChannel: "WHATSAPP",
  deliveryType: "RETIRO_TIENDA", salesRegion: "LIMA", taxMode: "INCLUIDO", shippingTotal: 0,
  items: [{ productVariantId: "variant-old", productName: "Producto anterior", sku: "OLD", quantity: 1, unitPrice: 158, discountAmount: 0 }],
  payments: [{ id: "payment-fixture", status: "PENDING", amount: 30, paymentMethod: "EFECTIVO", created_at: "2026-10-15T10:00:00Z" }],
};

afterEach(() => {
  cleanup();
  cancelSessionRefresh();
  tokenStore.set(null);
  jest.restoreAllMocks();
});

it("renews after a rejected PUT and retries the unchanged 59-price draft without reloading it", async () => {
  jest.clearAllMocks();
  const originalAdapter = axiosAuth.defaults.adapter;
  const originalUuid = crypto.randomUUID;
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "cart-fixture" });
  const expired = fixtureToken(Math.floor(Date.now() / 1000) - 60);
  const renewed = fixtureToken(Math.floor(Date.now() / 1000) + 3600);
  let session = {
    auth: {
      user: { id: "user-recovery", companyId: "company-recovery", name: "Vendedora", surname: "Fixture", email: "seller@example.invalid", role: "ADMIN", permissions: [] },
      company: { id: "company-recovery", name: "Empresa sintética", stores: SALE_CONTEXT.stores },
      accessToken: expired, subscription: null, exp: Math.floor(Date.now() / 1000) - 60,
    },
    loading: false, selectedStoreId: "store-recovery", inventories: [],
    setSelectedStore: jest.fn(), hasPermission: () => true,
  };
  jest.mocked(useAuth).mockImplementation(() => session as unknown as ReturnType<typeof useAuth>);
  tokenStore.set(expired, SCOPE);

  const refreshResponse = deferred<{ data: { accessToken: string } }>();
  const allowRetry = deferred<void>();
  const refreshPost = jest.spyOn(axios, "post").mockImplementation(() => refreshResponse.promise);
  const puts: { authorization: unknown; body: unknown; url: string | undefined }[] = [];
  let orderLoads = 0;
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    const response = { data: [] as unknown, status: 200, statusText: "OK", headers: {}, config };
    if (config.method === "put") {
      puts.push({ authorization: config.headers.get("Authorization"), body: JSON.parse(config.data as string), url: config.url });
      if (puts.length === 1) {
        throw new AxiosError("Expired fixture token", "ERR_BAD_REQUEST", config, undefined, {
          ...response, status: 401, statusText: "Unauthorized", data: {},
        });
      }
      return response;
    }
    if (config.url?.endsWith("/order-header/manual/order-recovery")) {
      orderLoads++;
      response.data = ORDER;
    } else if (config.url?.endsWith("/order-header/sale-context")) {
      response.data = SALE_CONTEXT;
    } else if (config.url?.endsWith("/inventory-item/search")) {
      response.data = { data: [], meta: { page: 1, total: 0, totalPages: 1 } };
    }
    return response;
  });
  axiosAuth.defaults.adapter = adapter;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const page = () => <QueryClientProvider client={queryClient}><RegistrarVentaPage /></QueryClientProvider>;
  const rendered = render(page());
  let published = false;
  const unregister = registerSessionRefresher(async () => {
    const token = await requestSessionToken(tokenStore.snapshot());
    if (!token) return false;
    tokenStore.set(token, SCOPE);
    session = { ...session, auth: { ...session.auth, accessToken: token, exp: Math.floor(Date.now() / 1000) + 3600 } };
    rendered.rerender(page());
    published = true;
    await allowRetry.promise;
    return true;
  });

  try {
    await userEvent.click(await screen.findByRole("button", { name: "Quitar Producto anterior" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar producto de 59" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /programar venta/i }));
    fireEvent.change(screen.getByLabelText("Fecha", { exact: true }), { target: { value: "2099-10-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));
    await waitFor(() => expect(refreshPost).toHaveBeenCalledTimes(1));
    expect(refreshPost).toHaveBeenCalledWith("/api/auth/refresh", {}, {
      withCredentials: true, signal: expect.any(AbortSignal),
    });

    await act(async () => { refreshResponse.resolve({ data: { accessToken: renewed } }); });
    await waitFor(() => expect(published).toBe(true));
    expect(screen.getByText("Producto nuevo: 59")).toBeInTheDocument();
    expect(screen.getByText("Total", { exact: true }).parentElement).toHaveTextContent("S/ 59.00");
    expect(screen.getByLabelText("Fecha", { exact: true })).toHaveValue("2099-10-15");
    expect(orderLoads).toBe(1);
    expect(puts).toHaveLength(1);

    await act(async () => { allowRetry.resolve(); });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Venta actualizada correctamente"));
    expect(puts).toHaveLength(2);
    expect(puts[0].authorization).toBe(`Bearer ${expired}`);
    expect(puts[1].authorization).toBe(`Bearer ${renewed}`);
    expect(puts[1].url).toBe(puts[0].url);
    expect(puts[1].body).toEqual(puts[0].body);
    expect(puts[1].body).toEqual(expect.objectContaining({
      items: [expect.objectContaining({ productVariantId: "variant-new", unitPrice: 59 })],
      callStatus: "SCHEDULED",
    }));
    expect(orderLoads).toBe(1);
    expect(toast.error).not.toHaveBeenCalled();
  } finally {
    unregister();
    cancelSessionRefresh();
    refreshResponse.resolve({ data: { accessToken: renewed } });
    allowRetry.resolve();
    cleanup();
    queryClient.clear();
    axiosAuth.defaults.adapter = originalAdapter;
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: originalUuid });
  }
});
