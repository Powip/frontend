/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: RegistrarVentaPage (app/registrar-venta/page.tsx)
 *
 * FIX aprobacion-pagos-solo-finanzas (ver
 * docs/features/FIX-aprobacion-pagos-solo-finanzas/spec.md): al crear una
 * venta nueva con adelanto + comprobante, ya NO se llama a
 * `PATCH .../payments/:id/approve` después de subir el comprobante
 * (`upload-proof`) — el pago queda PENDING hasta que Finanzas lo apruebe a
 * mano. Antes (FEAT-18 + fix 334cba8) ese PATCH /approve se disparaba
 * automáticamente.
 *
 * Comportamiento verificado:
 * 1. Sin adelanto (advancePayment = 0): el toast de éxito es el genérico
 *    "Venta registrada" y no se hace ningún PATCH de pagos.
 * 2. Con adelanto > 0 y SIN comprobante adjunto: no hay archivo que subir
 *    (no se hace ningún PATCH de pagos), pero el toast de éxito YA avisa
 *    que el adelanto quedó pendiente de aprobación en Finanzas — antes del
 *    fix este caso mostraba el toast genérico "Venta registrada" sin avisar
 *    nada, lo que confundía al vendedor (creía que el pago no había quedado
 *    registrado).
 * 3. Con adelanto > 0 y CON comprobante adjunto: se sube el comprobante
 *    (`PATCH .../upload-proof`) pero NUNCA se llama a `PATCH .../approve`,
 *    y el toast de éxito avisa igualmente que el adelanto quedó pendiente
 *    de aprobación en Finanzas.
 *
 * Esta página es enorme (cliente, catálogo, packs, pagos, envío) y monta
 * varios subsistemas reales. Para mantener el test enfocado en el flujo de
 * pago se mockean:
 * - `@/lib/axiosAuth` (todas las llamadas HTTP del flujo de creación).
 * - `@/contexts/AuthContext` (useAuth) — empresa y navegación fijas;
 *   sale-context devuelve tiendas y un almacén compartido independiente.
 *   El QueryClient real permite resolver las validaciones de origen.
 * - `@/services/clients.service` — se simula un cliente YA encontrado
 *   (`fetchClientByPhone` resuelve un cliente) para no tener que completar
 *   a mano el formulario de cliente nuevo (con sus Combobox de ubigeo).
 *   `updateClient` también se mockea resuelto por si algún test edita el
 *   formulario de cliente y dispara la rama de `updateClient` en
 *   `handleConfirmSale` (ver describe de regresión de `hasClientChanges` más
 *   abajo).
 * - `@/services/promos.service` — usado por `PacksProvider`;
 *   `listVolumePromos` resuelve `[]` para que `usePacksEngine` no interfiera
 *   con el submit (`packsEngine.pvsOpen` se mantiene `null`).
 * - `@/components/ui/select` — mock de `<select>` nativo (mismo patrón que
 *   `PaymentVerificationModal.test.tsx`), porque el Select real de Radix no
 *   es interactuable en jsdom sin polyfills de pointer capture.
 * - `@/components/registrar-venta/ProductSearchMatrix` — se reemplaza por un
 *   botón que agrega 1 producto fijo al carrito vía `onAddVariant`; el
 *   buscador/matriz real no es parte de lo que se prueba acá.
 * - `@/components/registrar-venta/CartLines` — expone botones mínimos para
 *   ejercer los callbacks reales de precio individual y masivo del formulario.
 *   `SuggestionsPanel` se mockea a `null` para reducir superficie.
 * - `@/components/modals/orderReceiptModal` — se abre tras un submit
 *   exitoso; se mockea a `null` porque no es parte de este flujo.
 *
 * Work-arounds jsdom:
 * - `crypto.randomUUID` no existe en el jsdom de este proyecto y `addToCart`
 *   lo usa para el `id` del `CartItem` — se parchea para todo el archivo
 *   (mismo patrón que `packs-promos/__tests__/page.test.tsx`).
 * - El input de comprobante (`<input type="file" className="hidden">`) se
 *   abre en producción vía un `onClick` en un div que llama a `.click()` en
 *   el input — `userEvent.upload()` hace un click real por debajo y ese
 *   click falla/no aplica sobre un input `display:none`. Se dispara
 *   `fireEvent.change` directo sobre el input (patrón documentado de
 *   Testing Library para file inputs ocultos por diseño).
 * - Los `<Label>` de este formulario son hermanos de sus inputs/Select, no
 *   están asociados vía `htmlFor`/`id` — `getByLabelText` no los encuentra.
 *   Se usa un helper `fieldByLabel` que ubica el `<label>` por texto y
 *   escala al contenedor (`within`) para aislar el control asociado.
 */

import {
  configure,
  render,
  screen,
  waitFor,
  within,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock("@/services/commercialLeadsService", () => ({
  confirmCommercialLead: jest.fn(), getCommercialLead: jest.fn(), getCommercialLeadCapabilities: jest.fn(), getCommercialLeadConfirmationCapabilities: jest.fn(), getCommercialLeadContext: jest.fn(), commercialLeadError: (error: unknown) => error instanceof Error ? error.message : "Acción rechazada",
}));
jest.mock("@/services/leadPaymentsService", () => ({ getLeadPayments: jest.fn() }));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: () => "/registrar-venta",
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

jest.mock("@/services/clients.service", () => ({
  fetchClientByPhone: jest.fn(),
  createClient: jest.fn(),
  updateClient: jest.fn(),
}));

jest.mock("@/services/promos.service", () => ({
  listVolumePromos: jest.fn().mockResolvedValue([]),
  createVolumePromo: jest.fn(),
  updatePromo: jest.fn(),
  deletePromo: jest.fn(),
}));
// Bundles are unrelated to the sale/payment/session behavior under test.
// Keep their shared-catalog contract explicit instead of hitting HTTP fixtures
// that model only order and inventory endpoints.
jest.mock("@/services/bundlePromos.service", () => ({
  listBundlePromos: jest.fn().mockResolvedValue({ bundles: [], deletedIds: [] }),
  getBundleCapabilities: jest.fn().mockResolvedValue({ canManage: false }),
  importBundlePromos: jest.fn(), createBundlePromo: jest.fn(),
  updateBundlePromo: jest.fn(), deleteBundlePromo: jest.fn(),
}));

jest.mock("@/components/ui/select", () => {
  const React = require("react");

  function extractText(node: unknown): string {
    if (node === null || node === undefined) return "";
    if (typeof node === "string" || typeof node === "number")
      return String(node);
    if (typeof node === "boolean") return "";
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (typeof node === "object" && node !== null && "props" in node) {
      const el = node as { props: { children?: unknown } };
      return extractText(el.props.children);
    }
    return "";
  }

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => {
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(
      children,
      (child: React.ReactElement<{ children?: React.ReactNode }>) => {
        if (!child || !child.props) return;
        if (child.props.children) {
          React.Children.forEach(
            child.props.children,
            (
              item: React.ReactElement<{
                value?: string;
                children?: React.ReactNode;
              }>,
            ) => {
              if (item && item.props && item.props.value !== undefined) {
                options.push({
                  value: item.props.value,
                  label: extractText(item.props.children),
                });
              }
            },
          );
        }
      },
    );
    return (
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectContent = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => <option value={value}>{children}</option>;
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );
  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  );

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

jest.mock("@/components/modals/orderReceiptModal", () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => open ? <div data-testid="receipt-open" /> : null,
}));

jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: ({ open, orderId, onClose, onEditOrder }: {
    open: boolean;
    orderId: string;
    onClose: () => void;
    onEditOrder?: () => void;
  }) => open ? (
    <section role="dialog" aria-label="Ficha del pedido" data-order-id={orderId}>
      <button onClick={onEditOrder}>Editar pedido desde ficha</button>
      <button onClick={onClose}>Cerrar ficha del pedido</button>
    </section>
  ) : null,
}));

jest.mock("@/components/registrar-venta/ProductSearchMatrix", () => ({
  __esModule: true,
  default: ({
    onAddVariant,
  }: {
    onAddVariant: (item: Record<string, unknown>) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onAddVariant({
          inventoryItemId: "inv-1",
          variantId: "var-1",
          productName: "Producto Test",
          sku: "SKU-1",
          price: 100,
          availableStock: 10,
          physicalStock: 10,
        })
      }
    >
      Agregar producto de test
    </button>
  ),
}));

jest.mock("@/components/registrar-venta/CartLines", () => ({
  __esModule: true,
  default: ({
    cart,
    onSetPrice,
    onBulkPrice,
  }: {
    cart: { id: string; productName: string }[];
    onSetPrice: (id: string, price: number) => void;
    onBulkPrice: (price: number) => void;
  }) => (
    <>
      {cart.map((item) => (
        <button key={item.id} type="button" onClick={() => onSetPrice(item.id, 50)}>
          Fijar {item.productName} en 50
        </button>
      ))}
      <button type="button" onClick={() => onBulkPrice(125)}>
        Fijar todos en 125
      </button>
    </>
  ),
}));

jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({
  __esModule: true,
  default: () => null,
}));

// ── Imports bajo prueba (después de los mocks) ──────────────────────────────

import axiosAuth from "@/lib/axiosAuth";
import { tokenStore } from "@/lib/tokenStore";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  createClient,
  fetchClientByPhone,
  updateClient,
} from "@/services/clients.service";
import RegistrarVentaPage from "../page";
import type { Client } from "@/interfaces/ICliente";
import { useRouter, useSearchParams } from "next/navigation";

jest.setTimeout(30000);
configure({ asyncUtilTimeout: 10000 });

process.env.NEXT_PUBLIC_API_VENTAS = "http://ventas";

const mockedAxiosAuth = axiosAuth as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  put: jest.Mock;
};
const mockToast = toast as jest.Mocked<typeof toast>;
const mockUseAuth = jest.mocked(useAuth);
const mockFetchClientByPhone = fetchClientByPhone as jest.Mock;
const mockCreateClient = createClient as jest.Mock;
const mockUpdateClient = updateClient as jest.Mock;
import { confirmCommercialLead, getCommercialLead, getCommercialLeadCapabilities, getCommercialLeadConfirmationCapabilities, getCommercialLeadContext } from "@/services/commercialLeadsService";
import { getLeadPayments } from "@/services/leadPaymentsService";

const mockUseSearchParams = jest.mocked(useSearchParams);
const mockUseRouter = jest.mocked(useRouter);
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

// `crypto.randomUUID` no existe en el jsdom de jest-environment-jsdom 29 y
// `addToCart` lo usa para el `id` del CartItem. Se parchea solo para este
// archivo (mismo patrón que packs-promos/__tests__/page.test.tsx).
type PatchTarget = { randomUUID?: () => string };
let patchedCryptoTarget: PatchTarget | null = null;
beforeAll(() => {
  let uuidSequence = 0;
  const randomUUID = () => `test-uuid-${++uuidSequence}`;
  const cryptoObj = globalThis.crypto as (Crypto & PatchTarget) | undefined;
  if (!cryptoObj) {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { randomUUID },
    });
    patchedCryptoTarget = globalThis.crypto as unknown as PatchTarget;
    return;
  }
  if (typeof cryptoObj.randomUUID !== "function") {
    Object.defineProperty(cryptoObj, "randomUUID", {
      configurable: true,
      writable: true,
      value: randomUUID,
    });
    patchedCryptoTarget = cryptoObj;
  }
});
afterAll(() => {
  if (patchedCryptoTarget) {
    Reflect.deleteProperty(patchedCryptoTarget, "randomUUID");
    patchedCryptoTarget = null;
  }
});

const FOUND_CLIENT: Client = {
  id: "client-1",
  companyId: "company-1",
  fullName: "Juan Pérez",
  phoneNumber: "999888777",
  clientType: "TRADICIONAL",
  province: "Lima",
  city: "Lima",
  district: "Miraflores",
  address: "Av. Test 123",
  isActive: true,
};

const SALE_CONTEXT = {
  companyId: "company-1",
  stores: [
    { id: "store-1", name: "Tienda navegación" },
    { id: "store-2", name: "Tienda de la venta" },
  ],
  inventories: [{ id: "warehouse-1", name: "Almacén compartido", storeId: "store-1" }],
};

const MOCK_AUTH = {
  auth: {
    user: {
      id: "user-1",
      name: "Vendedora",
      surname: "Test",
      email: "vendedora@powip.com",
      role: "ADMIN",
      permissions: [],
    },
    company: { id: "company-1", name: "Empresa Test", stores: SALE_CONTEXT.stores },
    accessToken: "fake-token",
    subscription: null,
    exp: 9999999999,
  },
  loading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateCompany: jest.fn(),
  selectedStoreId: "store-1",
  setSelectedStore: jest.fn(),
  inventories: [],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({
    push: mockRouterPush,
    replace: mockRouterReplace,
  } as unknown as ReturnType<typeof useRouter>);
  tokenStore.set("fake-token", "test-user-company");
  mockUseSearchParams.mockReturnValue(
    new URLSearchParams() as ReturnType<typeof useSearchParams>,
  );
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockedAxiosAuth.get.mockImplementation((url: string) => {
    if (url.endsWith("/order-header/sale-context"))
      return Promise.resolve({ data: SALE_CONTEXT });
    if (url.endsWith("/inventory-item/search"))
      return Promise.resolve({ data: { data: [], meta: { page: 1, total: 0, totalPages: 1 } } });
    return Promise.resolve({ data: [] });
  });
  mockFetchClientByPhone.mockResolvedValue(FOUND_CLIENT);
  mockUpdateClient.mockResolvedValue(FOUND_CLIENT);
});

describe("RegistrarVentaPage — guardar precios manuales superiores al PVP", () => {
  it("al editar guarda el precio 50 de la pulsera y conserva total 149 y saldo 119", async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("orderId=order-manual") as ReturnType<typeof useSearchParams>,
    );
    mockedAxiosAuth.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.includes("/order-header/manual/order-manual")
          ? {
              id: "order-manual",
              storeId: "store-1",
              customer: FOUND_CLIENT,
              orderType: "VENTA",
              status: "PENDIENTE",
              salesChannel: "WHATSAPP",
              closingChannel: "WHATSAPP",
              deliveryType: "RETIRO_TIENDA",
              salesRegion: "LIMA",
              taxMode: "INCLUIDO",
              shippingTotal: 0,
              items: [
                {
                  productVariantId: "box",
                  productName: "Caja",
                  sku: "BOX",
                  quantity: 1,
                  unitPrice: 99,
                  discountAmount: 11.8,
                },
                {
                  productVariantId: "engraving",
                  productName: "Grabado",
                  sku: "ENG",
                  quantity: 1,
                  unitPrice: 20,
                  discountAmount: 8.2,
                },
                {
                  productVariantId: "bracelet",
                  productName: "Pulsera",
                  sku: "BRA",
                  quantity: 1,
                  unitPrice: 45,
                  discountAmount: 0,
                },
              ],
              payments: [
                {
                  id: "payment-1",
                  status: "PENDING",
                  amount: 30,
                  paymentMethod: "EFECTIVO",
                  created_at: "2026-10-14T12:00:00Z",
                },
              ],
            }
          : url.endsWith("/order-header/sale-context")
            ? SALE_CONTEXT
            : url.endsWith("/inventory-item/search")
              ? { data: [], meta: { page: 1, total: 0, totalPages: 1 } }
              : [],
      }),
    );
    mockedAxiosAuth.put.mockResolvedValue({ data: {} });

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Fijar Pulsera en 50" }));

    const displayedGross = screen.getByText("Importe productos").parentElement?.textContent;
    const displayedDiscounts = screen.getByText("Total descuentos").parentElement?.textContent;
    expect(screen.getByText("Total", { exact: true }).parentElement).toHaveTextContent("S/ 149.00");
    expect(screen.getByText("Pendiente de pago").parentElement).toHaveTextContent("S/ 119.00");

    const saveButton = screen.getByRole("button", { name: "Actualizar venta" });
    expect(saveButton).toBeEnabled();
    await userEvent.click(saveButton);

    await waitFor(() => expect(mockedAxiosAuth.put).toHaveBeenCalled());
    expect(mockedAxiosAuth.put.mock.calls[0][0]).toContain("/order-header/manual/order-manual/full");
    const savedItems = mockedAxiosAuth.put.mock.calls[0][1].items as {
      unitPrice: number;
      quantity: number;
      discountAmount: number;
    }[];
    const savedTotal = savedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity - item.discountAmount,
      0,
    );
    expect(savedTotal).toBe(149);
    expect(savedTotal - 30).toBe(119);
    expect(savedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productVariantId: "bracelet",
          unitPrice: 50,
          discountType: "NONE",
          discountAmount: 0,
        }),
      ]),
    );
    expect(displayedGross).toContain("S/ 169.00");
    expect(displayedDiscounts).toContain("S/ 20.00");
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("al crear envía el precio masivo de 125 sobre el PVP original de 100", async () => {
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-bulk", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Fijar todos en 125" }));
    await userEvent.click(screen.getByRole("button", { name: /registrar pedido/i }));

    await waitFor(() =>
      expect(mockedAxiosAuth.post).toHaveBeenCalledWith(
        expect.stringContaining("/order-header"),
        expect.objectContaining({
          items: [
            expect.objectContaining({ unitPrice: 125, discountType: "NONE", discountAmount: 0 }),
          ],
        }),
      ),
    );
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const page = () => <QueryClientProvider client={queryClient}><RegistrarVentaPage /></QueryClientProvider>;
  const result = render(page());
  return { ...result, rerenderPage: () => result.rerender(page()) };
}

function mockEditableOrder(orderId = "order-session", client = FOUND_CLIENT) {
  mockUseSearchParams.mockReturnValue(
    new URLSearchParams(`orderId=${orderId}`) as ReturnType<typeof useSearchParams>,
  );
  mockedAxiosAuth.get.mockImplementation((url: string) => Promise.resolve({
    data: url.includes(`/order-header/manual/${orderId}`)
      ? {
          id: orderId,
          storeId: "store-1",
          customer: client,
          orderType: "VENTA",
          status: "PENDIENTE",
          salesChannel: "WHATSAPP",
          closingChannel: "WHATSAPP",
          deliveryType: "RETIRO_TIENDA",
          salesRegion: "LIMA",
          taxMode: "INCLUIDO",
          shippingTotal: 10,
          items: [{
            productVariantId: "bracelet", productName: "Pulsera", sku: "BRA",
            quantity: 1, unitPrice: 45, discountAmount: 0,
          }],
          payments: [{
            id: "paid-1", status: "PAID", amount: 20, paymentMethod: "EFECTIVO",
            created_at: "2026-10-14T12:00:00Z",
          }],
        }
      : url.endsWith("/order-header/sale-context")
        ? SALE_CONTEXT
        : url.endsWith("/inventory-item/search")
          ? { data: [], meta: { page: 1, total: 0, totalPages: 1 } }
          : [],
  }));
}

describe("RegistrarVentaPage — sesión durante la edición", () => {
  it("conserva precio y fecha sin recargar el pedido cuando se renueva el token", async () => {
    mockEditableOrder();
    mockedAxiosAuth.put.mockResolvedValue({ data: {} });
    const { rerenderPage } = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Fijar Pulsera en 50" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /programar venta/i }));
    fireEvent.change(screen.getByLabelText("Fecha", { exact: true }), { target: { value: "2099-10-15" } });

    mockUseAuth.mockReturnValue({
      ...MOCK_AUTH,
      auth: { ...MOCK_AUTH.auth, accessToken: "renewed-token" },
    } as unknown as ReturnType<typeof useAuth>);
    rerenderPage();

    expect(screen.getByText("Total", { exact: true }).parentElement).toHaveTextContent("S/ 60.00");
    expect(screen.getByLabelText("Fecha", { exact: true })).toHaveValue("2099-10-15");
    expect(mockedAxiosAuth.get.mock.calls.filter(([url]) => url.includes("/order-header/manual/"))).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));
    await waitFor(() => expect(mockedAxiosAuth.put).toHaveBeenCalledWith(
      expect.stringContaining("/order-session/full"),
      expect.objectContaining({
        items: [expect.objectContaining({ unitPrice: 50 })],
        callStatus: "SCHEDULED",
      }),
    ));
  });

  it("conserva lo editado tras un 401 definitivo y permite guardar al recuperar la sesión", async () => {
    mockEditableOrder();
    mockedAxiosAuth.put.mockRejectedValueOnce({ response: { status: 401 } });
    mockedAxiosAuth.put.mockResolvedValueOnce({ data: {} });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Fijar Pulsera en 50" }));
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining("Tu sesión venció y no se pudo renovar"),
    ));
    expect(screen.getByText("Total", { exact: true }).parentElement).toHaveTextContent("S/ 60.00");
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Venta actualizada correctamente"));
    expect(mockedAxiosAuth.put).toHaveBeenCalledTimes(2);
    expect(mockedAxiosAuth.put.mock.calls[1][1]).toEqual(mockedAxiosAuth.put.mock.calls[0][1]);
  });

  it.each(["user", "company", "order"])("limpia el borrador al cambiar %s y bloquea guardar mientras carga", async (changedScope) => {
    mockEditableOrder();
    const { rerenderPage } = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Fijar Pulsera en 50" }));
    mockedAxiosAuth.get.mockImplementation(() => new Promise(() => {}));
    if (changedScope === "order") {
      mockUseSearchParams.mockReturnValue(new URLSearchParams("orderId=another-order") as ReturnType<typeof useSearchParams>);
    } else {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: {
          ...MOCK_AUTH.auth,
          ...(changedScope === "user"
            ? { user: { ...MOCK_AUTH.auth.user, id: "another-user" } }
            : { company: { ...MOCK_AUTH.auth.company, id: "another-company" } }),
        },
      } as unknown as ReturnType<typeof useAuth>);
    }
    rerenderPage();
    expect(screen.queryByRole("button", { name: "Fijar Pulsera en 50" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar venta" })).toBeDisabled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
  });

  it("no continúa el guardado de una sesión anterior después de cambiar de cuenta", async () => {
    mockEditableOrder();
    let finishClientUpdate!: (client: Client) => void;
    mockUpdateClient.mockImplementationOnce(() => new Promise((resolve) => { finishClientUpdate = resolve; }));
    const { rerenderPage } = renderPage();
    await screen.findByRole("button", { name: "Fijar Pulsera en 50" });
    const address = within(fieldByLabel(/^dirección/i)).getByRole("textbox");
    fireEvent.change(address, { target: { value: "Dirección editada" } });
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));
    await waitFor(() => expect(mockUpdateClient).toHaveBeenCalled());

    tokenStore.invalidate();
    tokenStore.set("another-account-token", "another-account");
    mockUseAuth.mockReturnValue({
      ...MOCK_AUTH,
      auth: { ...MOCK_AUTH.auth, user: { ...MOCK_AUTH.auth.user, id: "another-user" } },
    } as unknown as ReturnType<typeof useAuth>);
    rerenderPage();
    await act(async () => { finishClientUpdate({ ...FOUND_CLIENT, address: "Dirección editada" }); });

    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
  });
});

/** Ubica un <label> por su texto y devuelve su contenedor (div hermano del
 *  control), para poder escalar con `within(...)` — los Label de este form no
 *  están asociados a su control vía htmlFor/id. */
function fieldByLabel(labelText: RegExp): HTMLElement {
  const label = screen.getByText((_content: string, element: Element | null) => {
    return (
      !!element &&
      element.tagName === "LABEL" &&
      labelText.test(element.textContent ?? "")
    );
  });
  return label.parentElement as HTMLElement;
}

/** Completa lo mínimo indispensable para que `canSubmit` sea true, sin tocar
 *  adelanto/comprobante (eso lo decide cada test). */
async function fillCommonRequiredFields() {
  await screen.findByDisplayValue("Almacén compartido");
  await userEvent.selectOptions(
    within(fieldByLabel(/tienda de la venta/i)).getByRole("combobox"),
    "store-2",
  );
  // Cliente: se busca por teléfono y se usa el cliente ya encontrado (evita
  // completar a mano el formulario de cliente nuevo).
  const phoneInput = screen.getByPlaceholderText("Número de teléfono");
  await userEvent.type(phoneInput, `${FOUND_CLIENT.phoneNumber}{Enter}`);
  await screen.findByText(/cliente encontrado/i);

  // Producto: 1 unidad agregada desde el stub de ProductSearchMatrix.
  await userEvent.click(
    screen.getByRole("button", { name: /agregar producto de test/i }),
  );

  // Método de pago (obligatorio siempre, más allá del monto del adelanto).
  await userEvent.selectOptions(
    within(fieldByLabel(/método de pago/i)).getByRole("combobox"),
    "EFECTIVO",
  );

  // Canal de venta / canal de cierre (obligatorios).
  await userEvent.selectOptions(
    within(fieldByLabel(/canal de venta/i)).getByRole("combobox"),
    "WHATSAPP",
  );
  await userEvent.selectOptions(
    within(fieldByLabel(/canal de cierre/i)).getByRole("combobox"),
    "WHATSAPP",
  );

  // Tipo de entrega: "Retiro en tienda" satisface hasValidDelivery sin
  // necesitar elegir un courier (el Select de "Método de envío" solo
  // aparece si el tipo de entrega es DOMICILIO).
  await userEvent.selectOptions(
    within(fieldByLabel(/tipo de entrega/i)).getByRole("combobox"),
    "RETIRO_TIENDA",
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RegistrarVentaPage — creación de venta con adelanto (FIX aprobacion-pagos-solo-finanzas)", () => {
  it("guarda los ingredientes escritos durante la venta como comentarios visibles para el cliente", async () => {
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-custom-shampoo", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();
    await userEvent.click(screen.getByRole("button", {
      name: "Comentarios e ID de publicidad (opcional)",
    }));
    const notes = screen.getByRole("textbox", { name: "Comentarios del pedido" });
    expect(notes).toHaveAccessibleDescription(/el cliente podrá verlos en Powip Link/);
    const ingredients = "Shampoo personalizado\nIngredientes: romero y aloe vera.\nSin perfume.";
    fireEvent.change(notes, { target: { value: ingredients } });
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledWith(
      expect.stringContaining("/order-header"),
      expect.objectContaining({ customerNotes: ingredients }),
    ));
  });

  it.each([
    ["CONTRA_ENTREGA", "COD"],
    ["EFECTIVO", "PREPAID"],
  ])("sends paymentCondition %s → %s with zero advance and no invented payment", async (method, condition) => {
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-no-advance", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();
    await userEvent.selectOptions(
      within(fieldByLabel(/método de pago/i)).getByRole("combobox"),
      method,
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());
    const orderCall = mockedAxiosAuth.post.mock.calls.find(([url]) => /\/order-header(?:\/manual)?$/.test(String(url)));
    expect(orderCall).toBeDefined();
    expect(orderCall![1]).toEqual(expect.objectContaining({ paymentCondition: condition }));
    expect(orderCall![1]).not.toHaveProperty("payments");
  });

  it("con comprobante adjunto: sube el comprobante pero NUNCA llama a /approve, y el toast avisa que queda pendiente de Finanzas", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-123", payments: [{ id: "payment-123" }] },
    });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });

    const { container } = renderPage();

    await fillCommonRequiredFields();

    // Adelanto de pago > 0.
    const advanceInput = within(
      fieldByLabel(/adelanto de pago/i),
    ).getByRole("textbox");
    await userEvent.type(advanceInput, "50");

    // Comprobante: el input real está oculto (className="hidden") y se abre
    // en producción vía un div con onClick que llama a .click() sobre el
    // input — se dispara el change directo (ver comentario de cabecera).
    const proofFile = new File(["comprobante"], "comprobante.png", {
      type: "image/png",
    });
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [proofFile] } });

    const confirmButton = screen.getByRole("button", {
      name: /registrar pedido/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());
    expect(mockedAxiosAuth.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/order-header\/manual$/),
      expect.objectContaining({
        storeId: "store-2",
        inventoryId: "warehouse-1",
        payments: [
          expect.objectContaining({ paymentMethod: "EFECTIVO", amount: 50 }),
        ],
      }),
    );

    await waitFor(() =>
      expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
        expect.stringContaining("payment-123/upload-proof"),
        expect.anything(),
        expect.anything(),
      ),
    );

    // El pago queda PENDING: nunca se llama al endpoint de aprobación desde
    // este flujo (antes del fix, esto se disparaba automáticamente).
    const approveCalls = mockedAxiosAuth.patch.mock.calls.filter(([url]) =>
      String(url).includes("/approve"),
    );
    expect(approveCalls).toHaveLength(0);

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        "Venta registrada. El adelanto quedó pendiente de aprobación en Finanzas.",
      ),
    );
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("sin comprobante adjunto: toast simple \"Venta registrada\" y ningún PATCH de pagos (ni upload-proof ni approve)", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-456", payments: [] },
    });

    renderPage();

    await fillCommonRequiredFields();

    const confirmButton = screen.getByRole("button", {
      name: /registrar pedido/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Venta registrada"),
    );
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("con adelanto > 0 pero sin comprobante adjunto: toast avisa que el adelanto queda pendiente de aprobación en Finanzas, y ningún PATCH de pagos (ni upload-proof ni approve)", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-789", payments: [{ id: "payment-789" }] },
    });

    renderPage();

    await fillCommonRequiredFields();

    // Adelanto de pago > 0, sin adjuntar ningún comprobante — el bloque de
    // subida se salta por `paymentProofFile` nulo, sin importar el monto.
    const advanceInput = within(
      fieldByLabel(/adelanto de pago/i),
    ).getByRole("textbox");
    await userEvent.type(advanceInput, "50");

    const confirmButton = screen.getByRole("button", {
      name: /registrar pedido/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        "Venta registrada. El adelanto quedó pendiente de aprobación en Finanzas.",
      ),
    );
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

describe("RegistrarVentaPage — hasClientChanges (fix orden de claves province/department)", () => {
  // Bug corregido: `hasClientChanges` comparaba `JSON.stringify(clientForm)`
  // contra un objeto con las claves `province`/`department` en orden
  // invertido respecto a como las arma el efecto que sincroniza `clientForm`
  // desde `clientFound`. Como `JSON.stringify` es sensible al orden de
  // inserción de claves, la comparación daba `true` (¡había "cambios"!)
  // SIEMPRE que había un cliente encontrado, aunque no se hubiera editado
  // nada, disparando un `updateClient()` innecesario en cada venta a un
  // cliente existente.

  it("cliente encontrado sin editar ningún campo: NO llama a updateClient al confirmar la venta", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-no-changes", payments: [] },
    });

    renderPage();

    await fillCommonRequiredFields();

    const confirmButton = screen.getByRole("button", {
      name: /registrar pedido/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Venta registrada"),
    );

    // Con el bug, este mock se llamaba igual aunque no se hubiera tocado el
    // formulario de cliente.
    expect(mockUpdateClient).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  // Timeout extendido (default 5000ms): esta página es pesada de renderizar y
  // el clear+type sobre el input de dirección suma ~6.7s en la suite
  // completa — no es un hang, es el costo real de montar el formulario.
  it("cliente encontrado editando la dirección: SÍ llama a updateClient al confirmar la venta", async () => {
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-with-changes", payments: [] },
    });

    renderPage();

    await fillCommonRequiredFields();

    const addressInput = screen.getByPlaceholderText("Dirección exacta");
    await userEvent.clear(addressInput);
    await userEvent.type(addressInput, "Av. Nueva 456");

    const confirmButton = screen.getByRole("button", {
      name: /registrar pedido/i,
    });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() =>
      expect(mockUpdateClient).toHaveBeenCalledWith(
        FOUND_CLIENT.id,
        expect.objectContaining({ address: "Av. Nueva 456" }),
      ),
    );

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Venta registrada"),
    );
    expect(mockToast.error).not.toHaveBeenCalled();
  }, 15000);
});

describe("RegistrarVentaPage — actualización parcial del cliente al confirmar", () => {
  it("guarda la dirección con distrito válido sin reenviar provincia incompleta ni enlace antiguo sin modificar", async () => {
    const legacyClient = {
      ...FOUND_CLIENT,
      province: "",
      googleMapsUrl: "ubicación pendiente",
    };
    mockFetchClientByPhone.mockResolvedValue(legacyClient);
    mockUpdateClient.mockResolvedValue({ ...legacyClient, address: "Av. Nueva 456" });
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-legacy-client", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();

    fireEvent.change(screen.getByPlaceholderText("Dirección exacta"), {
      target: { value: "Av. Nueva 456" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1));
    expect(mockUpdateClient).toHaveBeenCalledWith(FOUND_CLIENT.id, {
      companyId: FOUND_CLIENT.companyId,
      address: "Av. Nueva 456",
    });
    expect(mockToast.success).toHaveBeenCalledWith("Venta registrada");
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("conserva datos, carrito, adelanto y comprobante tras un error y registra una sola venta al reintentar", async () => {
    mockUpdateClient
      .mockRejectedValueOnce(new Error("connection interrupted"))
      .mockResolvedValueOnce({ ...FOUND_CLIENT, address: "Av. Nueva 456" });
    mockedAxiosAuth.post.mockResolvedValue({
      data: { id: "order-client-retry", payments: [{ id: "payment-client-retry", status: "PENDING" }] },
    });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });
    renderPage();
    await fillCommonRequiredFields();
    const address = screen.getByPlaceholderText("Dirección exacta");
    fireEvent.change(address, { target: { value: "Av. Nueva 456" } });
    const advance = within(fieldByLabel(/adelanto de pago/i)).getByRole("textbox");
    fireEvent.change(advance, { target: { value: "20" } });
    const proof = new File(["comprobante"], "adelanto-cliente.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/comprobante de pago \(opcional\)/i), {
      target: { files: [proof] },
    });

    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());

    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
    expect(address).toHaveValue("Av. Nueva 456");
    expect(screen.getByPlaceholderText("Número de teléfono")).toHaveValue(FOUND_CLIENT.phoneNumber);
    expect(advance).toHaveValue("20");
    expect(within(fieldByLabel(/método de pago/i)).getByRole("combobox")).toHaveValue("EFECTIVO");
    expect(screen.getByRole("button", { name: "Fijar Producto Test en 50" })).toBeInTheDocument();
    expect(screen.getByText(proof.name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pedido" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    await screen.findByTestId("receipt-open");

    expect(mockUpdateClient).toHaveBeenCalledTimes(2);
    expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1);
    expect(mockedAxiosAuth.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/order-header(?:\/manual)?$/),
      expect.objectContaining({
        customerId: FOUND_CLIENT.id,
        payments: [expect.objectContaining({ amount: 20, paymentMethod: "EFECTIVO" })],
        items: [expect.objectContaining({ productVariantId: "var-1", quantity: 1 })],
      }),
    );
    expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(1);
    expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
      expect.stringContaining("/payments/payments/payment-client-retry/upload-proof"),
      expect.any(FormData),
      expect.any(Object),
    );
    expect((mockedAxiosAuth.patch.mock.calls[0][1] as FormData).get("file")).toBe(proof);
  });

  it.each([
    ["número", "DNI", "87654321"],
    ["tipo", "CARNET", "12345678"],
  ] as const)("envía el tipo y el número de documento juntos al cambiar solo el %s", async (field, documentType, documentNumber) => {
    const client = { ...FOUND_CLIENT, documentType: "DNI" as const, documentNumber: "12345678" };
    mockFetchClientByPhone.mockResolvedValue(client);
    mockUpdateClient.mockResolvedValue({ ...client, documentType, documentNumber });
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-document-change", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();

    if (field === "número") {
      fireEvent.change(screen.getByPlaceholderText("Número"), { target: { value: documentNumber } });
    } else {
      await userEvent.selectOptions(
        within(fieldByLabel(/^tipo de documento/i)).getByRole("combobox"),
        documentType,
      );
    }
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1));
    expect(mockUpdateClient).toHaveBeenCalledWith(client.id, {
      companyId: client.companyId,
      documentType,
      documentNumber,
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("envía null en ambos campos al quitar el documento opcional de una venta de Lima", async () => {
    const client = { ...FOUND_CLIENT, documentType: "DNI" as const, documentNumber: "12345678" };
    mockFetchClientByPhone.mockResolvedValue(client);
    mockUpdateClient.mockResolvedValue({ ...FOUND_CLIENT, documentType: null, documentNumber: null });
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-document-cleared", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();

    await userEvent.selectOptions(
      within(fieldByLabel(/^tipo de documento/i)).getByRole("combobox"),
      "NONE",
    );
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1));
    expect(mockUpdateClient).toHaveBeenCalledWith(client.id, {
      companyId: client.companyId,
      documentType: null,
      documentNumber: null,
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

describe("RegistrarVentaPage — distrito obligatorio para clientes encontrados", () => {
  const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  beforeAll(() => {
    // Radix mide el popover real al abrirlo; jsdom no ofrece esta API de layout.
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  });
  afterAll(() => {
    if (resizeObserverDescriptor) {
      Object.defineProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "ResizeObserver");
    }
  });

  function locationControl(field: "department" | "province" | "district") {
    const index = { department: 0, province: 1, district: 2 }[field];
    return within(fieldByLabel(/^dirección/i)).getAllByRole("combobox")[index];
  }

  async function selectLocation(
    field: "department" | "province" | "district",
    option: string,
  ) {
    await userEvent.click(locationControl(field));
    await userEvent.click(within(screen.getByRole("dialog")).getByText(option, { exact: true }));
  }

  function expectDistrictRequired(buttonName = "Registrar pedido") {
    expect(screen.getByText("9 de 10 pasos completados")).toBeInTheDocument();
    expect(screen.queryByText("10 de 10 pasos completados")).not.toBeInTheDocument();
    expect(screen.getByText("Selecciona el distrito del cliente")).toBeInTheDocument();
    expect(screen.getByText("Selecciona el distrito para continuar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: buttonName })).toBeDisabled();
  }

  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
  ])("no permite confirmar un cliente encontrado con distrito %s aunque se edite su dirección", async (_description, district) => {
    mockFetchClientByPhone.mockResolvedValue({ ...FOUND_CLIENT, district });
    renderPage();
    await fillCommonRequiredFields();
    expectDistrictRequired();

    fireEvent.change(screen.getByPlaceholderText("Dirección exacta"), {
      target: { value: "Av. Nueva 456" },
    });
    expectDistrictRequired();
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    expect(mockUpdateClient).not.toHaveBeenCalled();
    expect(jest.mocked(createClient)).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
  });

  it("bloquea Actualizar venta cuando el cliente de una orden existente no tiene distrito", async () => {
    mockEditableOrder("order-missing-district", { ...FOUND_CLIENT, district: "" });
    renderPage();
    await screen.findByRole("button", { name: "Fijar Pulsera en 50" });

    expectDistrictRequired("Actualizar venta");
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));

    expect(mockUpdateClient).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
  });

  it("completa el checklist y permite guardar al seleccionar el distrito faltante", async () => {
    mockFetchClientByPhone.mockResolvedValue({ ...FOUND_CLIENT, district: "" });
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-district-completed", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();
    expectDistrictRequired();

    await selectLocation("district", "Miraflores");

    expect(screen.getByText("10 de 10 pasos completados")).toBeInTheDocument();
    expect(screen.queryByText("Selecciona el distrito para continuar.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pedido" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1));
    expect(mockUpdateClient).toHaveBeenCalledWith(FOUND_CLIENT.id, {
      companyId: FOUND_CLIENT.companyId,
      district: "Miraflores",
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it.each([
    { field: "province", option: "Barranca", district: "Paramonga" },
    { field: "department", option: "Arequipa", district: "Cayma" },
  ] as const)("al cambiar $field limpia el distrito y bloquea hasta seleccionar el nuevo", async ({ field, option, district }) => {
    const client = { ...FOUND_CLIENT, documentType: "DNI" as const, documentNumber: "12345678" };
    mockFetchClientByPhone.mockResolvedValue(client);
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-location-changed", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();
    expect(screen.getByText("10 de 10 pasos completados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pedido" })).toBeEnabled();

    await selectLocation(field, option);

    expectDistrictRequired();
    expect(locationControl("district")).toHaveTextContent("Distrito");
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    expect(mockUpdateClient).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();

    if (field === "department") {
      expect(locationControl("province")).toHaveTextContent("Provincia");
      expect(locationControl("district")).toBeDisabled();
      await selectLocation("province", "Arequipa");
      expectDistrictRequired();
    }
    await selectLocation("district", district);

    expect(screen.getByText("10 de 10 pasos completados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pedido" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1));
    expect(mockUpdateClient).toHaveBeenCalledWith(client.id, {
      companyId: client.companyId,
      province: option,
      district,
      ...(field === "department" ? { city: option } : {}),
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

describe("RegistrarVentaPage — persistencia de comprobantes", () => {
  const savedProofUrl = "https://storage.example.com/comprobante-guardado.pdf";
  const pendingPayment = {
    id: "pending-payment",
    status: "PENDING",
    amount: 30,
    paymentMethod: "EFECTIVO",
    paymentProofUrl: savedProofUrl,
    created_at: "2026-10-14T12:00:00Z",
  };
  const paidPayment = {
    ...pendingPayment,
    id: "paid-payment",
    status: "PAID",
    amount: 20,
    created_at: "2026-10-13T12:00:00Z",
  };
  const selectedFile = () => new File(["comprobante"], "nuevo-comprobante.pdf", { type: "application/pdf" });

  function prepareEditing(payments = [pendingPayment]) {
    const order = {
      id: "order-proofs",
      storeId: "store-1",
      inventoryId: "warehouse-1",
      customer: FOUND_CLIENT,
      orderType: "VENTA",
      status: "PENDIENTE",
      salesChannel: "WHATSAPP",
      closingChannel: "WHATSAPP",
      deliveryType: "RETIRO_TIENDA",
      salesRegion: "LIMA",
      taxMode: "INCLUIDO",
      shippingTotal: 0,
      items: [{
        productVariantId: "product-1",
        productName: "Producto guardado",
        sku: "SKU-1",
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
      }],
      payments,
    };
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("orderId=order-proofs") as ReturnType<typeof useSearchParams>,
    );
    mockedAxiosAuth.get.mockImplementation((url: string) =>
      Promise.resolve({ data: url.includes("/order-header/manual/") || url.endsWith("/order-header/order-proofs")
        ? order
        : url.endsWith("/order-header/sale-context")
          ? SALE_CONTEXT
          : url.endsWith("/inventory-item/search")
            ? { data: [], meta: { page: 1, total: 0, totalPages: 1 } }
            : [] }),
    );
    mockedAxiosAuth.put.mockResolvedValue({ data: order });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });
    return order;
  }

  function attachProof(file = selectedFile()) {
    fireEvent.change(screen.getByLabelText(/comprobante de pago \(opcional\)/i), {
      target: { files: [file] },
    });
    return file;
  }

  it("conserva el comentario histórico solo para el equipo al editar otros datos", async () => {
    const order = prepareEditing();
    const legacyNotes = "Devolución del courier — mercadería registrada como merma";
    Object.assign(order, { notes: legacyNotes });
    renderPage();
    await screen.findByRole("link", { name: /ver comprobante guardado/i });
    await userEvent.click(screen.getByRole("button", {
      name: "Comentarios e ID de publicidad (opcional)",
    }));
    expect(screen.getByRole("textbox", { name: "Comentarios del pedido" })).toHaveValue("");
    expect(screen.getByText(legacyNotes)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));

    await waitFor(() => expect(mockedAxiosAuth.put).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.put.mock.calls[0][1]).not.toHaveProperty("notes");
    expect(mockedAxiosAuth.put.mock.calls[0][1]).not.toHaveProperty("customerNotes");
  });

  it("permite revisar y compartir explícitamente los ingredientes de un pedido anterior", async () => {
    const order = prepareEditing();
    const legacyNotes = "Shampoo personalizado\nIngredientes: romero y aloe vera.";
    Object.assign(order, { notes: legacyNotes });
    renderPage();
    await screen.findByRole("link", { name: /ver comprobante guardado/i });
    await userEvent.click(screen.getByRole("button", {
      name: "Comentarios e ID de publicidad (opcional)",
    }));
    await userEvent.click(screen.getByRole("button", { name: "Usar como comentario para el cliente" }));
    expect(screen.getByRole("textbox", { name: "Comentarios del pedido" })).toHaveValue(legacyNotes);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));

    await waitFor(() => expect(mockedAxiosAuth.put).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.put.mock.calls[0][1]).toEqual(expect.objectContaining({ customerNotes: legacyNotes }));
    expect(mockedAxiosAuth.put.mock.calls[0][1]).not.toHaveProperty("notes");
  });

  it("al editar muestra el comprobante guardado y conserva el pago si solo cambia la venta", async () => {
    prepareEditing();
    renderPage();

    const savedLink = await screen.findByRole("link", { name: /ver comprobante guardado/i });
    expect(savedLink).toHaveAttribute("href", savedProofUrl);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));

    await waitFor(() => expect(mockedAxiosAuth.put).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.put.mock.calls[0][1]).not.toHaveProperty("paymentAmount");
    expect(mockedAxiosAuth.put.mock.calls[0][1]).not.toHaveProperty("paymentProofUrl");
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
  });

  it("al editar sube el nuevo archivo al pago pendiente, conserva el aprobado y no aprueba automáticamente", async () => {
    prepareEditing([paidPayment, pendingPayment]);
    renderPage();
    await screen.findAllByRole("link", { name: /ver comprobante guardado/i });
    const file = attachProof();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));

    await waitFor(() => expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(1));
    const [url, formData] = mockedAxiosAuth.patch.mock.calls[0];
    expect(url).toContain("/payments/pending-payment/upload-proof");
    expect((formData as FormData).get("file")).toBe(file);
    expect(mockedAxiosAuth.put.mock.calls[0][1]).not.toHaveProperty("paymentAmount");
    expect(mockedAxiosAuth.patch.mock.calls.some(([requestUrl]) => String(requestUrl).includes("/approve"))).toBe(false);
  });

  it("con varios pendientes exige elegir el pago antes de actualizar y adjunta al elegido", async () => {
    prepareEditing([pendingPayment, { ...pendingPayment, id: "second-payment", amount: 40 }]);
    renderPage();
    await screen.findAllByRole("link", { name: /ver comprobante guardado/i });
    attachProof();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));
    expect(mockToast.warning).toHaveBeenCalledWith("Selecciona a qué pago corresponde el comprobante.");
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();

    await userEvent.selectOptions(
      within(fieldByLabel(/pago al que corresponde el comprobante/i)).getByRole("combobox"),
      "second-payment",
    );
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));
    await waitFor(() => expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.patch.mock.calls[0][0]).toContain("/payments/second-payment/upload-proof");
  });

  it("un adelanto nuevo se adjunta al pago creado por la edición y no al ya aprobado", async () => {
    const order = prepareEditing([paidPayment]);
    mockedAxiosAuth.put.mockResolvedValue({ data: {
      ...order,
      payments: [paidPayment, { ...pendingPayment, id: "new-payment", amount: 50 }],
    } });
    renderPage();
    await screen.findByRole("link", { name: /ver comprobante guardado/i });
    await userEvent.type(within(fieldByLabel(/adelanto de pago/i)).getByRole("textbox"), "50");
    attachProof();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));

    await waitFor(() => expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.patch.mock.calls[0][0]).toContain("/payments/new-payment/upload-proof");
    expect(mockedAxiosAuth.put.mock.calls[0][1].paymentAmount).toBe(70);
  });

  it("si falla la subida al editar conserva el archivo y el reintento no repite la actualización", async () => {
    prepareEditing();
    mockedAxiosAuth.patch.mockRejectedValueOnce(new Error("upload unavailable"));
    renderPage();
    await screen.findByRole("link", { name: /ver comprobante guardado/i });
    const file = attachProof();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar venta" }));
    const retry = await screen.findByRole("button", { name: "Reintentar comprobante" });
    expect(retry.closest("[inert]")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("El pedido ya está guardado");
    expect(screen.getByText(file.name)).toBeInTheDocument();
    expect(mockToast.success).not.toHaveBeenCalled();

    await userEvent.click(retry);
    await waitFor(() => expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(2));
    expect(mockedAxiosAuth.put).toHaveBeenCalledTimes(1);
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect((mockedAxiosAuth.patch.mock.calls[1][1] as FormData).get("file")).toBe(file);
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith(
      "Comprobante guardado correctamente. El pedido ya estaba registrado.",
    ));
  });

  it("si falla la subida al crear conserva el archivo y reintenta sin duplicar la venta ni el adelanto", async () => {
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "created-order", payments: [pendingPayment] } });
    const networkError = new AxiosError("Network Error", "ERR_NETWORK");
    expect(networkError.response).toBeUndefined();
    mockedAxiosAuth.patch.mockRejectedValueOnce(networkError).mockResolvedValue({ data: {} });
    renderPage();
    await fillCommonRequiredFields();
    await userEvent.type(within(fieldByLabel(/adelanto de pago/i)).getByRole("textbox"), "30");
    const file = attachProof(new File(["imagen"], "comprobante.jpg", { type: "image/jpeg" }));
    await userEvent.click(screen.getByRole("button", { name: /registrar pedido/i }));
    const retry = await screen.findByRole("button", { name: "Reintentar comprobante" });
    expect(retry.closest("[inert]")).toBeNull();
    expect(screen.getByText(file.name)).toBeInTheDocument();
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId("receipt-open")).not.toBeInTheDocument();

    mockedAxiosAuth.get.mockResolvedValue({ data: { payments: [pendingPayment] } });
    await userEvent.click(retry);
    await waitFor(() => expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(2));
    expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1);
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
    expect((mockedAxiosAuth.patch.mock.calls[1][1] as FormData).get("file")).toBe(file);
    await waitFor(() => expect(screen.getByTestId("receipt-open")).toBeInTheDocument());
  });
});

describe("RegistrarVentaPage — documentos de identidad en provincia", () => {
  const provinceClient: Client = {
    ...FOUND_CLIENT,
    province: "Arequipa",
    city: "Arequipa",
    district: "Cayma",
    documentType: "CARNET",
    documentNumber: "CE1234567",
  };
  const documentChecklist =
    "Completa el documento de identidad del cliente (obligatorio para ventas de provincia)";

  function prepareProvinceEditing(client = provinceClient) {
    const order = {
      id: "order-province-document",
      storeId: "store-1",
      customer: client,
      orderType: "VENTA",
      status: "PENDIENTE",
      salesChannel: "WHATSAPP",
      closingChannel: "WHATSAPP",
      deliveryType: "RETIRO_TIENDA",
      salesRegion: "PROVINCIA",
      taxMode: "INCLUIDO",
      shippingTotal: 0,
      items: [{
        productVariantId: "product-1",
        productName: "Producto guardado",
        sku: "SKU-1",
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
      }],
      payments: [],
    };
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(`orderId=${order.id}`) as ReturnType<typeof useSearchParams>,
    );
    mockedAxiosAuth.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.includes(`/order-header/manual/${order.id}`)
          ? order
          : url.endsWith("/order-header/sale-context")
            ? SALE_CONTEXT
            : url.endsWith("/inventory-item/search")
              ? { data: [], meta: { page: 1, total: 0, totalPages: 1 } }
              : [],
      }),
    );
    mockedAxiosAuth.put.mockResolvedValue({ data: order });
    return order;
  }

  it.each([
    ["CE", "CARNET", "CE1234567"],
    ["CE numérico con cero inicial", "CARNET", "001234567"],
    ["pasaporte", "PASAPORTE", "AB123456"],
    ["DNI", "DNI", "12345678"],
  ] as const)("permite confirmar una venta de provincia con cliente encontrado y %s válido", async (_label, documentType, documentNumber) => {
    mockFetchClientByPhone.mockResolvedValue({ ...provinceClient, documentType, documentNumber });
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-document", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();

    expect(screen.getByText(documentChecklist)).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: /registrar pedido/i });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledWith(
      expect.stringContaining("/order-header"),
      expect.objectContaining({ customerId: provinceClient.id, salesRegion: "PROVINCIA" }),
    ));
    expect(mockUpdateClient).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("habilita Actualizar venta con CE válido en provincia y guarda la edición", async () => {
    const order = prepareProvinceEditing();
    renderPage();
    await screen.findByDisplayValue(provinceClient.documentNumber!);
    await userEvent.selectOptions(
      within(fieldByLabel(/método de pago/i)).getByRole("combobox"),
      "EFECTIVO",
    );

    const updateButton = screen.getByRole("button", { name: "Actualizar venta" });
    expect(updateButton).toBeEnabled();
    await userEvent.click(updateButton);

    await waitFor(() => expect(mockedAxiosAuth.put).toHaveBeenCalledWith(
      expect.stringContaining(`/order-header/manual/${order.id}/full`),
      expect.objectContaining({
        customerId: provinceClient.id,
        salesRegion: "PROVINCIA",
        items: [expect.objectContaining({ productVariantId: "product-1", unitPrice: 100 })],
      }),
    ));
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it.each([
    ["sin tipo", undefined, ""],
    ["CE vacío", "CARNET", ""],
    ["CE demasiado corto", "CARNET", "12345"],
    ["CE con caracteres inválidos", "CARNET", "CE12-3456"],
    ["DNI inválido", "DNI", "123456"],
  ] as const)("bloquea actualizar una venta de provincia con documento %s", async (_label, documentType, documentNumber) => {
    prepareProvinceEditing({ ...provinceClient, documentType, documentNumber });
    renderPage();
    await screen.findByDisplayValue(provinceClient.fullName);
    await userEvent.selectOptions(
      within(fieldByLabel(/método de pago/i)).getByRole("combobox"),
      "EFECTIVO",
    );

    expect(screen.getByText(documentChecklist)).toBeInTheDocument();
    const updateButton = screen.getByRole("button", { name: "Actualizar venta" });
    expect(updateButton).toBeDisabled();
    await userEvent.click(updateButton);
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
  });

  it("crea un cliente con CE de provincia al confirmar si la nueva búsqueda falla", async () => {
    mockFetchClientByPhone.mockResolvedValueOnce(provinceClient).mockRejectedValueOnce(new Error("network unavailable"));
    const createdClient = { ...provinceClient, id: "created-ce-client", phoneNumber: "999888778" };
    mockCreateClient.mockResolvedValue(createdClient);
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "order-new-ce-client", payments: [] } });
    renderPage();
    await fillCommonRequiredFields();

    // La búsqueda fallida conserva los datos completados y activa la creación
    // automática de cliente, que además ejecuta validateClientForm al confirmar.
    const phoneInput = screen.getByPlaceholderText("Número de teléfono");
    fireEvent.change(phoneInput, { target: { value: createdClient.phoneNumber } });
    fireEvent.keyDown(phoneInput, { key: "Enter" });
    await screen.findByText(/no se pudo buscar el cliente.*completa los datos manualmente/i);
    mockToast.error.mockClear();

    const confirmButton = screen.getByRole("button", { name: /registrar pedido/i });
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);

    await waitFor(() => expect(mockCreateClient).toHaveBeenCalledWith(expect.objectContaining({
      documentType: "CARNET",
      documentNumber: provinceClient.documentNumber,
      fullName: provinceClient.fullName,
      phoneNumber: createdClient.phoneNumber,
      city: "Arequipa",
    })));
    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledWith(
      expect.stringContaining("/order-header"),
      expect.objectContaining({ customerId: createdClient.id, salesRegion: "PROVINCIA" }),
    ));
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});


describe("Registrar — confirmación canónica de Lead sobre origen e IMEI de producción", () => {
  beforeEach(() => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("leadId=lead-1") as ReturnType<typeof useSearchParams>);
    jest.mocked(getCommercialLeadCapabilities).mockResolvedValue({enabled:true, phase:"foundation",canView:true,canManage:true,canManageTypes:false});
    jest.mocked(getCommercialLeadConfirmationCapabilities).mockResolvedValue({enabled:true,canConfirm:true});
    jest.mocked(getCommercialLead).mockResolvedValue({id:"lead-1",companyId:"company-1",storeId:"store-2",status:"NUEVO",version:7,currency:"PEN",contactName:"Cliente Lead",contactPhone:"999999999",customFields:{}} as never);
    jest.mocked(getCommercialLeadContext).mockResolvedValue({leadId:"lead-1",sources:[],order:null,quotationId:null,liveCheckoutId:null});
    jest.mocked(getLeadPayments).mockResolvedValue({data:[{id:"payment-existing",status:"PAID",amount:"20.00",currency:"PEN"}],total:1,page:1,limit:20} as never);
    jest.mocked(confirmCommercialLead).mockResolvedValue({lead:{id:"lead-1"},order:{id:"order-lead",orderNumber:"ORD-LEAD"},replayed:false} as never);
  });
  async function fillLead() {
    await screen.findByText(/Anticipos aprobados:/);
    await fillCommonRequiredFields();
    await userEvent.selectOptions(screen.getByLabelText("Condición de cobro *"),"COD");
  }
  it("confirma el Lead con la tienda y almacén seleccionados sin recrear sus anticipos", async () => {
    renderPage();await fillLead();
    await userEvent.click(screen.getByRole("button",{name:"Confirmar compra"}));
    await waitFor(() => expect(confirmCommercialLead).toHaveBeenCalledTimes(1));
    const command=jest.mocked(confirmCommercialLead).mock.calls[0][1];
    expect(command).toEqual(expect.objectContaining({version:7,order:expect.objectContaining({storeId:"store-2",inventoryId:"warehouse-1",currency:"PEN",paymentCondition:"COD"})}));
    expect(command.order).not.toHaveProperty("payments");
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
  });
  it("reintenta una respuesta incierta con el mismo comando y pedido", async () => {
    jest.mocked(confirmCommercialLead).mockRejectedValueOnce(new Error("Respuesta interrumpida"));
    renderPage();await fillLead();
    await userEvent.click(screen.getByRole("button",{name:"Confirmar compra"}));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Respuesta interrumpida"));
    await userEvent.click(screen.getByRole("button",{name:"Confirmar compra"}));
    await waitFor(() => expect(confirmCommercialLead).toHaveBeenCalledTimes(2));
    expect(jest.mocked(confirmCommercialLead).mock.calls[1]).toEqual(jest.mocked(confirmCommercialLead).mock.calls[0]);
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
  });
  it("rechaza un Lead de otra empresa antes de crear cliente, pedido o pago", async () => {
    jest.mocked(getCommercialLead).mockResolvedValue({id:"lead-1",companyId:"company-foreign",storeId:"store-2",status:"NUEVO"} as never);
    renderPage();
    await screen.findByText(/Selecciona la empresa y tienda del Lead/);
    expect(screen.getByRole("button",{name:"Confirmar compra"})).toBeDisabled();
    expect(mockCreateClient).not.toHaveBeenCalled();expect(mockedAxiosAuth.post).not.toHaveBeenCalled();expect(confirmCommercialLead).not.toHaveBeenCalled();
  });
});

describe("Pedidos Shopify pendientes — DNI, envío y adelantos", () => {
  const order = {
    id: "order-shopify-lead",
    storeId: "store-1",
    inventoryId: "warehouse-1",
    orderNumber: "SHOP-101",
    customer: FOUND_CLIENT,
    commercialStage: "LEAD",
    commercialLeadId: "lead-shopify",
    canalOrigen: "shopify_cod",
    orderType: "VENTA",
    status: "PENDIENTE",
    salesChannel: "SHOPIFY",
    closingChannel: "SHOPIFY",
    deliveryType: "DOMICILIO",
    courier: "Courier Test",
    salesRegion: "LIMA",
    taxMode: "INCLUIDO",
    shippingTotal: 11,
    grandTotal: 111,
    items: [{
      productVariantId: "product-1",
      productName: "Producto guardado",
      sku: "SKU-1",
      quantity: 1,
      unitPrice: 100,
      discountAmount: 0,
    }],
    payments: [],
  };
  function responseData(url: string, savedOrder: Record<string, unknown> = order) {
    if (url.endsWith("/order-header/sale-context")) return SALE_CONTEXT;
    if (url.endsWith("/inventory-item/search")) {
      return { data: [], meta: { page: 1, total: 0, totalPages: 1 } };
    }
    return url.includes(`/order-header/${order.id}`) || url.includes(`/order-header/manual/${order.id}`)
      ? savedOrder
      : [];
  }
  beforeEach(() => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(`orderId=${order.id}`) as ReturnType<typeof useSearchParams>,
    );
    mockedAxiosAuth.get.mockImplementation((url: string) => Promise.resolve({
      data: responseData(url),
    }));
  });

  it("guarda los datos y reabre la misma ficha sin enviar a Leads ni generar comprobante", async () => {
    mockedAxiosAuth.put.mockResolvedValue({ data: order });
    renderPage();
    const save = await screen.findByRole("button", { name: "Guardar datos del pedido" });
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.queryByRole("link", { name: /volver al lead/i })).not.toBeInTheDocument();
    const shipping = within(fieldByLabel(/^Costo de envío$/)).getByRole("textbox");
    await userEvent.clear(shipping);
    await userEvent.type(shipping, "15");
    await userEvent.click(save);

    expect(await screen.findByRole("dialog", { name: "Ficha del pedido" })).toHaveAttribute("data-order-id", order.id);
    expect(mockedAxiosAuth.put).toHaveBeenCalledWith(
      expect.stringContaining(`/order-header/manual/${order.id}/full`),
      expect.objectContaining({ shippingTotal: 15 }),
    );
    expect(mockedAxiosAuth.put.mock.calls[0][1]).not.toHaveProperty("paymentAmount");
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("receipt-open")).not.toBeInTheDocument();
    expect(confirmCommercialLead).not.toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith("Datos del pedido actualizados correctamente");

    mockedAxiosAuth.get.mockImplementation((url: string) => Promise.resolve({
      data: responseData(url, { ...order, shippingTotal: 15 }),
    }));
    await userEvent.click(screen.getByRole("button", { name: "Editar pedido desde ficha" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ficha del pedido" })).not.toBeInTheDocument());
    expect(await within(fieldByLabel(/^Costo de envío$/)).findByDisplayValue("15")).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(MOCK_AUTH.setSelectedStore).not.toHaveBeenCalled();
  });

  it("vuelve a la ficha del mismo pedido sin guardar y al cerrarla regresa a atención al cliente", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Guardar datos del pedido" });
    await userEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(await screen.findByRole("dialog", { name: "Ficha del pedido" })).toHaveAttribute("data-order-id", order.id);
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar ficha del pedido" }));
    expect(mockRouterPush).toHaveBeenCalledWith("/atencion-cliente");
  });

  it.each([
    ["/operaciones/pedidos", "/operaciones/pedidos"],
    ["//example.com", "/atencion-cliente"],
  ])("al cerrar la ficha valida el destino de regreso %s", async (returnTo, expected) => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams({ orderId: order.id, returnTo }) as ReturnType<typeof useSearchParams>,
    );
    renderPage();
    await screen.findByRole("button", { name: "Guardar datos del pedido" });
    await userEvent.click(screen.getByRole("button", { name: "Volver" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cerrar ficha del pedido" }));
    expect(mockRouterPush).toHaveBeenCalledWith(expected);
  });

  it("conserva el regreso al Lead para pedidos ajenos a Shopify COD", async () => {
    mockedAxiosAuth.get.mockImplementation((url: string) => Promise.resolve({
      data: responseData(url, { ...order, canalOrigen: "WEB" }),
    }));
    mockedAxiosAuth.put.mockResolvedValue({ data: {} });
    renderPage();
    const save = await screen.findByRole("button", { name: "Actualizar venta" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith(`/leads-comerciales?leadId=${order.commercialLeadId}`));
    expect(screen.queryByRole("dialog", { name: "Ficha del pedido" })).not.toBeInTheDocument();
  });

  it("registra un adelanto desde el pedido y conserva el envío y el DNI sin guardar", async () => {
    renderPage();
    await screen.findByDisplayValue(FOUND_CLIENT.fullName);

    const shipping = within(fieldByLabel(/^Costo de envío$/)).getByRole("textbox");
    expect(shipping).toBeEnabled();
    await userEvent.clear(shipping);
    await userEvent.type(shipping, "15");
    await userEvent.selectOptions(
      within(fieldByLabel(/^Tipo de documento/)).getByRole("combobox"), "DNI",
    );
    const dni = within(fieldByLabel(/^N° Documento/)).getByRole("textbox");
    await userEvent.type(dni, "87654321");
    await userEvent.click(screen.getByRole("button", { name: "Registrar adelanto" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Registrar Nuevo Pago");
    expect(within(dialog).queryByRole("button", { name: /^Aprobar/ })).not.toBeInTheDocument();
    const saved = {
      id: "payment-shopify", amount: "30", status: "PENDING", paymentMethod: "YAPE",
      paymentDate: "2026-10-22T22:20:00Z", created_at: "2026-10-22T22:20:00Z",
    };
    mockedAxiosAuth.get.mockImplementation((url: string) => Promise.resolve({
      data: responseData(url, { ...order, payments: [saved] }),
    }));
    mockedAxiosAuth.post.mockResolvedValue({ data: saved });
    await userEvent.type(within(dialog).getByLabelText("Monto *"), "30");
    await userEvent.selectOptions(within(dialog).getByRole("combobox"), "YAPE");
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar Pago" }));
    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1));
    const [url, payload] = mockedAxiosAuth.post.mock.calls[0];
    expect(url).toContain(`/payments/orders/${order.id}/payments/with-proof`);
    expect((payload as FormData).get("amount")).toBe("30");
    expect((payload as FormData).get("paymentMethod")).toBe("YAPE");
    expect(await screen.findByText("Adelantos pendientes: S/ 30.00")).toBeInTheDocument();
    expect(shipping).toHaveValue("15");
    expect(dni).toHaveValue("87654321");
    expect(mockedAxiosAuth.put).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();

  });

  it("explica cuando el usuario puede editar datos pero no registrar pagos", async () => {
    mockUseAuth.mockReturnValue({
      ...MOCK_AUTH,
      hasPermission: () => false,
      auth: {
        ...MOCK_AUTH.auth,
        user: { ...MOCK_AUTH.auth.user, role: "VENDEDOR", businessAdmin: false, permissions: ["EDIT_SALE"] },
      },
    } as unknown as ReturnType<typeof useAuth>);
    renderPage();
    expect(await screen.findByText("No tienes permiso para registrar pagos.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar adelanto" })).not.toBeInTheDocument();
  });
});
